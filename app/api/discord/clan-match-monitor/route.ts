import { NextRequest, NextResponse } from "next/server";
import { getCompanionRecentMatches } from "@/lib/aoe2-coach";
import { AGE2BRASIL_CLAN } from "@/lib/age2brasil-clan-roster";
import { getAdminSupabase } from "@/lib/server-supabase";

export const runtime = "nodejs";
export const maxDuration = 60;
type Match = { id:string; map:string; completedAt:string|null; durationSeconds:number|null; gameModeName:string; leaderboardName:string; participants:Array<{nickname:string;profileId:number;rating:number|null;ratingDiff:number|null;civilizationName:string|null;teamId:number|null;won:boolean}> };

function authorized(req:NextRequest) {
  const secret=process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization")===`Bearer ${secret}`;
}
function discordEmbed(match:Match, detectedNick:string) {
  const groups=new Map<number,Match["participants"]>();
  match.participants.forEach(p=>{const id=Number(p.teamId??0);groups.set(id,[...(groups.get(id)??[]),p]);});
  const fields=[...groups.entries()].slice(0,4).map(([id,players])=>({
    name:`Equipe ${id+1}${players.some(p=>p.won)?" 🏆":""}`,
    value:players.map(p=>`${p.nickname}${p.rating!==null?` · Elo ${p.rating}`:""}${p.ratingDiff!==null?` (${p.ratingDiff>0?"+":""}${p.ratingDiff})`:""}${p.civilizationName?` · ${p.civilizationName}`:""}`).join("\n").slice(0,1024)||"Dados indisponíveis",
    inline:true
  }));
  const winner=match.participants.find(p=>p.won);
  const date=match.completedAt?new Date(match.completedAt).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"}):"—";
  const duration=match.durationSeconds?`${Math.floor(match.durationSeconds/60)}m ${match.durationSeconds%60}s`:"—";
  const url=`https://www.aoe2companion.com/matches/${encodeURIComponent(match.id)}`;
  return {title:`${winner?"🏆 Vitória":"⚔️ Partida concluída"} · ${match.map||"Mapa"}`,url,color:winner?0x4b9b57:0xb77a36,
    description:`Detectada pelo perfil **${detectedNick}** · **Modo:** ${match.gameModeName||match.leaderboardName||"—"} · **Duração:** ${duration}`,
    fields:[{name:"Resultado",value:winner?`Vencedor: **${winner.nickname}**`:"Resultado não identificado",inline:true},{name:"Mapa / horário",value:`${match.map||"—"}\n${date}`,inline:true},...fields].slice(0,25),
    footer:{text:`AGE2BRASIL · Match ID ${match.id} · Abra a página para conferir o replay, quando disponível`}};
}
export async function GET(req:NextRequest) {
  if(!authorized(req))return NextResponse.json({error:"Unauthorized"},{status:401});
  const webhook=process.env.DISCORD_AOE2_MATCH_WEBHOOK_URL;
  if(!webhook)return NextResponse.json({error:"Configure DISCORD_AOE2_MATCH_WEBHOOK_URL."},{status:503});
  let db;try{db=getAdminSupabase();}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Supabase não configurado"},{status:503});}
  const roster=AGE2BRASIL_CLAN.members.filter(m=>m.profileId&&m.status==="verified");
  const found=new Map<string,{match:Match;nick:string}>(),errors:string[]=[];
  // Batch queries to keep API load and serverless duration bounded.
  for(let i=0;i<roster.length;i+=4){
    const batch=await Promise.all(roster.slice(i,i+4).map(async member=>{
      try{return {member,result:await getCompanionRecentMatches(member.profileId!)};}
      catch(e){errors.push(`${member.nickname}: ${e instanceof Error?e.message:"consulta falhou"}`);return null;}
    }));
    for(const item of batch){if(!item)continue;for(const match of item.result.matches as Match[]){
      const mode=String(match.leaderboardName??"").toLowerCase();
      if(!(mode.includes("ranked")||mode.startsWith("rm_"))||!match.completedAt)continue;
      if(!found.has(match.id))found.set(match.id,{match,nick:item.member.nickname});
    }}
  }
  let posted=0,duplicates=0;
  for(const {match,nick} of found.values()){
    const {data:existing,error:checkError}=await db.from("discord_clan_match_posts").select("match_id").eq("match_id",match.id).maybeSingle();
    if(checkError){errors.push(`Dedup ${match.id}: ${checkError.message}`);continue;}
    if(existing){duplicates++;continue;}
    const response=await fetch(webhook,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({embeds:[discordEmbed(match,nick)]}),signal:AbortSignal.timeout(10000)});
    if(!response.ok){errors.push(`Discord HTTP ${response.status}, match ${match.id}`);continue;}
    const {error}=await db.from("discord_clan_match_posts").insert({match_id:match.id,tracked_profile_id:roster.find(m=>m.nickname===nick)?.profileId,posted_at:new Date().toISOString(),match_payload:match});
    if(error)errors.push(`Registro ${match.id}: ${error.message}`);else posted++;
  }
  return NextResponse.json({ok:errors.length===0,membersChecked:roster.length,matchesFound:found.size,posted,duplicates,errors:errors.slice(0,10)});
}
