import { NextRequest, NextResponse } from "next/server";
import { getCompanionRecentMatches } from "@/lib/aoe2-coach";
import { AGE2BRASIL_CLAN } from "@/lib/age2brasil-clan-roster";
import { getAdminSupabase } from "@/lib/server-supabase";

export const runtime = "nodejs";
export const maxDuration = 60;
type Match = { id:string; map:string; completedAt:string|null; durationSeconds:number|null; gameModeName:string; leaderboardName:string; participants:Array<{nickname:string;profileId:number;rating:number|null;ratingDiff:number|null;civilizationName:string|null;teamId:number|null;won:boolean}> };

const FEED_KEY = "age2brasil-ranked";
function authorized(req:NextRequest) {
  const secret=process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization")===`Bearer ${secret}`;
}
function isRankedQueue(match:Match) {
  // Only trust the queue/leaderboard metadata. "Random Map" is a map/game mode,
  // not proof of ranked status, so never use gameModeName alone.
  const leaderboard=String(match.leaderboardName??"").trim().toLowerCase();
  return leaderboard.includes("ranked") || /^(rm_|rm\b|ranked\b)/.test(leaderboard);
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
    description:`Detectada pelo perfil **${detectedNick}** · **Fila:** ${match.leaderboardName||"Ranked"} · **Duração:** ${duration}`,
    fields:[{name:"Resultado",value:winner?`Vencedor: **${winner.nickname}**`:"Resultado não identificado",inline:true},{name:"Mapa / horário",value:`${match.map||"—"}\n${date}`,inline:true},...fields].slice(0,25),
    footer:{text:`AGE2BRASIL · Match ID ${match.id} · Abra a página para conferir o replay, quando disponível`}};
}
export async function GET(req:NextRequest) {
  if(!authorized(req))return NextResponse.json({error:"Unauthorized"},{status:401});
  const webhook=process.env.DISCORD_AOE2_MATCH_WEBHOOK_URL;
  if(!webhook)return NextResponse.json({error:"Configure DISCORD_AOE2_MATCH_WEBHOOK_URL."},{status:503});
  let db;try{db=getAdminSupabase();}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Supabase não configurado"},{status:503});}
  const scanStartedAt=new Date().toISOString();
  let state;const stateResult=await db.from("discord_clan_match_feed_state").select("last_successful_scan_at").eq("feed_key",FEED_KEY).maybeSingle();
  if(stateResult.error)return NextResponse.json({error:`Feed state: ${stateResult.error.message}`},{status:503});
  state=stateResult.data;
  // First activation establishes a baseline and deliberately does not backfill old games.
  if(!state){
    const init=await db.from("discord_clan_match_feed_state").insert({feed_key:FEED_KEY,last_successful_scan_at:scanStartedAt});
    if(init.error && !String(init.error.code).includes("23505"))return NextResponse.json({error:init.error.message},{status:503});
    return NextResponse.json({ok:true,baselineInitialized:true,baseline:scanStartedAt,posted:0,message:"Feed initialized. Only matches completed after this timestamp will be published."});
  }
  const cursor=Date.parse(state.last_successful_scan_at);
  const roster=AGE2BRASIL_CLAN.members.filter(m=>m.profileId&&m.status==="verified");
  const found=new Map<string,{match:Match;nick:string}>(),errors:string[]=[];
  let profilesSucceeded=0,rankedCandidates=0,tooOld=0,unrecognizedQueue=0;
  // Batches keep API load bounded. If a profile query fails, do not advance the cursor.
  for(let i=0;i<roster.length;i+=4){
    const batch=await Promise.all(roster.slice(i,i+4).map(async member=>{
      try{return {member,result:await getCompanionRecentMatches(member.profileId!)};}
      catch(e){errors.push(`${member.nickname}: ${e instanceof Error?e.message:"consulta falhou"}`);return null;}
    }));
    for(const item of batch){if(!item)continue;profilesSucceeded++;for(const match of item.result.matches as Match[]){
      if(!match.completedAt)continue;
      const completed=Date.parse(match.completedAt);
      if(!Number.isFinite(completed)||completed<=cursor){tooOld++;continue;}
      if(!isRankedQueue(match)){unrecognizedQueue++;continue;}
      rankedCandidates++;
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
  // Advance only if every profile was queried and all outgoing writes succeeded.
  if(errors.length===0 && profilesSucceeded===roster.length){
    const update=await db.from("discord_clan_match_feed_state").update({last_successful_scan_at:scanStartedAt}).eq("feed_key",FEED_KEY);
    if(update.error)errors.push(`Cursor: ${update.error.message}`);
  }
  return NextResponse.json({ok:errors.length===0,membersChecked:roster.length,profilesSucceeded,matchesFound:found.size,rankedCandidates,posted,duplicates,ignoredBeforeCursor:tooOld,ignoredNonRankedOrUnknown:unrecognizedQueue,cursor:state.last_successful_scan_at,errors:errors.slice(0,10)});
}
