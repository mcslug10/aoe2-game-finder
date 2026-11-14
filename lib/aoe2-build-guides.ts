export type BuildAge = "dark" | "feudal" | "castle" | "imperial";

export type BuildGuideCheck =
  | { kind: "age"; age: "feudal" | "castle" | "imperial"; maxSeconds?: number }
  | { kind: "unit"; age: BuildAge; terms: string[]; minimum: number }
  | { kind: "building"; age: BuildAge; terms: string[]; minimum: number }
  | { kind: "technology"; terms: string[] }
  | { kind: "fast-castle" }
  | { kind: "unique-castle-unit" }
  | { kind: "walls" };

export type BuildGuideStep = {
  id: string;
  phase: string;
  villagerMarker?: string;
  title: string;
  description: string;
  check?: BuildGuideCheck;
};

export type BuildGuide = {
  id: string;
  category: "Feudal Rush" | "Fast Castle (FC)" | "Dark Age Rush (drush)" | "Water Maps";
  categoryPt: string;
  titleOriginal: string;
  titlePt: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  difficultyPt: string;
  description: string;
  sourceUrl: string;
  steps: BuildGuideStep[];
};

const commonOpening = [
  {
    id: "opening-houses",
    phase: "Dark Age",
    villagerMarker: "3",
    title: "2 Houses e produção contínua",
    description: "Coloque Villagers em produção no Town Center. Use 2 Villagers em uma House e 1 Villager na outra; depois envie-os para Sheep.",
  },
  {
    id: "opening-sheep-wood",
    phase: "Dark Age",
    villagerMarker: "4–10",
    title: "Sheep e Lumber Camp",
    description: "Leve os próximos Villagers para Sheep. No 7º Villager, construa o Lumber Camp; os seguintes vão para Wood.",
    check: { kind: "building" as const, age: "dark" as const, terms: ["lumber camp"], minimum: 1 },
  },
  {
    id: "opening-boar-berries",
    phase: "Dark Age",
    villagerMarker: "11–17",
    title: "Boar, Berries e Mill",
    description: "Traga o Boar, construa 2 Houses perto das Berries, faça o Mill e distribua Villagers entre Berries e Sheep/Boar. Puxe o segundo Boar quando indicado.",
  },
];

export const AOE2_BUILD_GUIDES: BuildGuide[] = [
  {
    id: "scout-rush",
    category: "Feudal Rush",
    categoryPt: "Pressão na Era Feudal",
    titleOriginal: "Scout Rush",
    titlePt: "Ataque de Scouts",
    difficulty: "Intermediate",
    difficultyPt: "Intermediária",
    description: "Pressione cedo com Scouts, usando mobilidade para incomodar Villagers, explorar a base e interromper a economia adversária.",
    sourceUrl: "https://aoecompanion.com/build-guides/scout-rush",
    steps: [
      ...commonOpening,
      { id: "scout-click-feudal", phase: "Dark Age", villagerMarker: "20", title: "Loom, Feudal Age e Barracks", description: "Pesquise Loom e avance para Feudal Age. Construa o Barracks antes de chegar à nova era.", check: { kind: "age", age: "feudal" } },
      { id: "scout-stable", phase: "Feudal Age", villagerMarker: "20", title: "Stable e 2–3 Scouts", description: "Construa um Stable e produza 2–3 Scouts para pressionar a base inimiga.", check: { kind: "building", age: "feudal", terms: ["stable"], minimum: 1 } },
      { id: "scout-production", phase: "Feudal Age", title: "Manter pressão e melhorar a economia", description: "Continue produzindo Scouts conforme os recursos permitirem. Pesquise Double-Bit Axe e Horse Collar e transforme Wood excedente em Farms.", check: { kind: "unit", age: "feudal", terms: ["scout cavalry", "scout"], minimum: 2 } },
    ],
  },
  {
    id: "archer-rush",
    category: "Feudal Rush",
    categoryPt: "Pressão na Era Feudal",
    titleOriginal: "Archer Rush",
    titlePt: "Ataque de Archers",
    difficulty: "Intermediate",
    difficultyPt: "Intermediária",
    description: "Ataque a economia adversária assim que chegar à Feudal Age com um grupo de Archers, apoiado por produção contínua e upgrades.",
    sourceUrl: "https://aoecompanion.com/build-guides/archer-rush",
    steps: [
      ...commonOpening,
      { id: "archer-feudal-click", phase: "Dark Age", villagerMarker: "21", title: "Loom e Feudal Age", description: "Ajuste Wood e Gold durante a subida. Construa Barracks antes de alcançar Feudal Age.", check: { kind: "age", age: "feudal" } },
      { id: "archer-ranges", phase: "Feudal Age", villagerMarker: "21", title: "Duas Archery Ranges", description: "Pesquise Double-Bit Axe e construa 2 Archery Ranges para iniciar produção constante de Archers.", check: { kind: "building", age: "feudal", terms: ["archery range"], minimum: 2 } },
      { id: "archer-mass", phase: "Feudal Age", title: "Massa de Archers e Blacksmith", description: "Produza cerca de 6–8 Archers, construa Blacksmith e pesquise Fletching antes de iniciar a pressão.", check: { kind: "unit", age: "feudal", terms: ["archer"], minimum: 4 } },
      { id: "archer-transition", phase: "Feudal Age", title: "Economia e transição", description: "Mantenha Gold e Farms, pesquise Wheelbarrow quando a economia permitir e prepare a transição para Castle Age.", check: { kind: "technology", terms: ["fletching"] } },
    ],
  },
  {
    id: "maa-archers",
    category: "Feudal Rush",
    categoryPt: "Pressão na Era Feudal",
    titleOriginal: "Men-at-Arms Rush → Archers",
    titlePt: "Men-at-Arms seguido de Archers",
    difficulty: "Advanced",
    difficultyPt: "Avançada",
    description: "Use 3 Militia na Dark Age; transforme-os em Men-at-Arms ao chegar à Feudal Age e depois transicione para Archers.",
    sourceUrl: "https://aoecompanion.com/build-guides/men-at-arms-archers",
    steps: [
      ...commonOpening,
      { id: "maa-barracks-militia", phase: "Dark Age", villagerMarker: "19", title: "Barracks e 3 Militia", description: "Construa Barracks, produza 3 Militia e mantenha o restante da economia em Food e Gold para a subida.", check: { kind: "unit", age: "dark", terms: ["militia"], minimum: 3 } },
      { id: "maa-feudal-upgrade", phase: "Feudal Age", villagerMarker: "21", title: "Men-at-Arms e Double-Bit Axe", description: "Pesquise Men-at-Arms no Barracks e Double-Bit Axe no Lumber Camp. Leve a pressão até a base adversária.", check: { kind: "technology", terms: ["man at arms"] } },
      { id: "maa-archer-transition", phase: "Feudal Age", title: "Transição para Archers", description: "Adicione Archery Range(s), coloque Archers em produção e faça Blacksmith/Fletching conforme os recursos permitirem.", check: { kind: "unit", age: "feudal", terms: ["archer"], minimum: 2 } },
    ],
  },
  {
    id: "maa-tower-rush",
    category: "Feudal Rush",
    categoryPt: "Pressão na Era Feudal",
    titleOriginal: "Men-at-Arms + Tower Rush",
    titlePt: "Men-at-Arms + avanço de Towers",
    difficulty: "Advanced",
    difficultyPt: "Avançada",
    description: "Combine a pressão inicial de Militia/Men-at-Arms com Villagers avançados e Towers para controlar ou negar recursos importantes do adversário.",
    sourceUrl: "https://aoecompanion.com/build-guides/men-at-arms-towers",
    steps: [
      ...commonOpening,
      { id: "tower-militia", phase: "Dark Age", villagerMarker: "19", title: "Barracks, 3 Militia e Stone", description: "Construa Barracks, treine 3 Militia e comece a mineração de Stone conforme o guia.", check: { kind: "unit", age: "dark", terms: ["militia"], minimum: 3 } },
      { id: "tower-forward", phase: "Feudal Age", title: "Avançar com Villagers", description: "Ao chegar à Feudal Age, leve Villagers para a base adversária e pressione pontos de coleta e rotas de expansão.", check: { kind: "age", age: "feudal" } },
      { id: "tower-builds", phase: "Feudal Age", title: "Men-at-Arms e Towers", description: "Pesquise Men-at-Arms e posicione Towers para negar recursos ou proteger sua posição avançada. O replay pode não registrar a intenção/localização da Tower.", check: { kind: "building", age: "feudal", terms: ["watch tower", "guard tower", "keep"], minimum: 1 } },
    ],
  },
  {
    id: "fast-castle-boom",
    category: "Fast Castle (FC)",
    categoryPt: "Fast Castle",
    titleOriginal: "Fast Castle → Boom",
    titlePt: "Fast Castle seguido de Boom",
    difficulty: "Beginner",
    difficultyPt: "Iniciante",
    description: "Priorize uma subida rápida para Castle Age e use a vantagem de tempo para expandir a economia com Town Centers adicionais.",
    sourceUrl: "https://aoecompanion.com/build-guides/fast-castle-boom",
    steps: [
      ...commonOpening,
      { id: "fc-boom-feudal", phase: "Dark Age", villagerMarker: "27", title: "Clique para Feudal Age", description: "Concentre a economia em Food, Wood e Gold. A referência do guia é um avanço com aproximadamente 27 Villagers.", check: { kind: "age", age: "feudal" } },
      { id: "fc-boom-castle", phase: "Feudal Age", villagerMarker: "29", title: "Market, Blacksmith e Castle Age", description: "Evite investir em um exército Feudal grande. Construa Market e Blacksmith para liberar o avanço aos Castelos.", check: { kind: "fast-castle" } },
      { id: "fc-boom-tcs", phase: "Castle Age", title: "Town Centers adicionais", description: "Expanda para 2 ou 3 Town Centers no total e mantenha Villagers em produção; distribua a economia para sustentar o Boom.", check: { kind: "building", age: "castle", terms: ["town center"], minimum: 2 } },
    ],
  },
  {
    id: "fast-castle-knights",
    category: "Fast Castle (FC)",
    categoryPt: "Fast Castle",
    titleOriginal: "Fast Castle → Knights",
    titlePt: "Fast Castle seguido de Knights",
    difficulty: "Beginner",
    difficultyPt: "Iniciante",
    description: "Chegue rapidamente à Castle Age e use Stable(s) para produzir Knights e iniciar pressão militar.",
    sourceUrl: "https://aoecompanion.com/build-guides/fast-castle-knights",
    steps: [
      ...commonOpening,
      { id: "knights-click-feudal", phase: "Dark Age", villagerMarker: "27", title: "Economia e clique para Feudal Age", description: "Siga a abertura econômica do guia, com Wood, Food e Gold suficientes para avançar.", check: { kind: "age", age: "feudal" } },
      { id: "knights-click-castle", phase: "Feudal Age", villagerMarker: "28", title: "Market, Blacksmith e Castle Age", description: "Construa Barracks, Market e Blacksmith e priorize o clique para Castle Age, sem prolongar a produção Feudal.", check: { kind: "fast-castle" } },
      { id: "knights-production", phase: "Castle Age", title: "Stable e produção de Knights", description: "Construa Stable(s), produza Knights e pressione a economia adversária. Adicione upgrades de ataque/armadura e Bloodlines conforme a situação.", check: { kind: "unit", age: "castle", terms: ["knight", "cavalier"], minimum: 2 } },
    ],
  },
  {
    id: "fast-castle-unique-unit",
    category: "Fast Castle (FC)",
    categoryPt: "Fast Castle",
    titleOriginal: "Fast Castle → Unique Unit",
    titlePt: "Fast Castle seguido de Unique Unit",
    difficulty: "Beginner",
    difficultyPt: "Iniciante",
    description: "Alcance a Castle Age rapidamente, construa um Castle e comece a produzir a Unique Unit da civilização.",
    sourceUrl: "https://aoecompanion.com/build-guides/fast-castle-unique-unit",
    steps: [
      ...commonOpening,
      { id: "uu-click-castle", phase: "Dark/Feudal Age", villagerMarker: "28", title: "Subida rápida para Castle Age", description: "Priorize a economia e construa as estruturas exigidas para avançar sem montar um exército Feudal grande.", check: { kind: "fast-castle" } },
      { id: "uu-castle", phase: "Castle Age", title: "Construir Castle", description: "Reserve Stone e posicione um Castle em local que proteja a economia ou permita iniciar a pressão.", check: { kind: "building", age: "castle", terms: ["castle"], minimum: 1 } },
      { id: "uu-production", phase: "Castle Age", title: "Produzir a Unique Unit", description: "Inicie a produção da Unique Unit da sua civilização e complemente com upgrades e unidades de apoio adequadas.", check: { kind: "unique-castle-unit" } },
    ],
  },
  {
    id: "fast-imperial",
    category: "Fast Castle (FC)",
    categoryPt: "Fast Castle",
    titleOriginal: "Fast Imperial Age",
    titlePt: "Avanço rápido para Imperial Age",
    difficulty: "Beginner",
    difficultyPt: "Iniciante",
    description: "Acelere a progressão entre as eras para chegar à Imperial Age cedo e então iniciar a produção militar para atacar.",
    sourceUrl: "https://aoecompanion.com/build-guides/fast-imperial",
    steps: [
      ...commonOpening,
      { id: "imp-feudal", phase: "Dark Age", villagerMarker: "30", title: "Feudal Age com economia focada", description: "Priorize Food, Wood e Gold; o guia apresenta avanço Feudal com aproximadamente 30 Villagers.", check: { kind: "age", age: "feudal" } },
      { id: "imp-market-blacksmith", phase: "Feudal Age", villagerMarker: "30–32", title: "Market e Blacksmith", description: "Construa Market e Blacksmith para liberar o avanço à Castle Age.", check: { kind: "building", age: "feudal", terms: ["market"], minimum: 1 } },
      { id: "imp-monastery-siege", phase: "Castle Age", villagerMarker: "32", title: "Monastery e Siege Workshop", description: "Construa Monastery e Siege Workshop enquanto prepara o avanço para Imperial Age.", check: { kind: "building", age: "castle", terms: ["monastery", "siege workshop"], minimum: 2 } },
      { id: "imp-age", phase: "Castle Age", villagerMarker: "34", title: "Clique para Imperial Age", description: "Avance para Imperial Age assim que os recursos permitirem; depois, coloque unidades militares em produção.", check: { kind: "age", age: "imperial", maxSeconds: 26 * 60 } },
    ],
  },
  {
    id: "drush-archers",
    category: "Dark Age Rush (drush)",
    categoryPt: "Pressão na Era Sombria",
    titleOriginal: "Drush → Archers",
    titlePt: "Drush seguido de Archers",
    difficulty: "Advanced",
    difficultyPt: "Avançada",
    description: "Produza 3 Militia ainda na Dark Age para atrasar o adversário e depois transicione para Archers na Feudal Age.",
    sourceUrl: "https://aoecompanion.com/build-guides/dark-age-rush-archers",
    steps: [
      ...commonOpening,
      { id: "drush-archers-militia", phase: "Dark Age", villagerMarker: "17", title: "Barracks e 3 Militia", description: "Construa Barracks, produza 3 Militia e envie-os junto com o Scout para incomodar a economia adversária.", check: { kind: "unit", age: "dark", terms: ["militia"], minimum: 3 } },
      { id: "drush-archers-feudal", phase: "Dark Age", villagerMarker: "25–28", title: "Loom e Feudal Age", description: "Complete a economia, pesquise Loom e avance para Feudal Age.", check: { kind: "age", age: "feudal" } },
      { id: "drush-archers-ranges", phase: "Feudal Age", title: "Archery Range e Archers", description: "Adicione Archery Range(s), produza Archers e pesquise Fletching quando tiver massa e recursos.", check: { kind: "unit", age: "feudal", terms: ["archer"], minimum: 3 } },
    ],
  },
  {
    id: "drush-fast-castle",
    category: "Dark Age Rush (drush)",
    categoryPt: "Pressão na Era Sombria",
    titleOriginal: "Drush → Fast Castle",
    titlePt: "Drush seguido de Fast Castle",
    difficulty: "Advanced",
    difficultyPt: "Avançada",
    description: "Use 3 Militia na Dark Age para distrair o adversário e, em seguida, concentre a economia para chegar rapidamente à Castle Age.",
    sourceUrl: "https://aoecompanion.com/build-guides/drush-fast-castle",
    steps: [
      ...commonOpening,
      { id: "drush-fc-militia", phase: "Dark Age", villagerMarker: "17", title: "Barracks e 3 Militia", description: "Construa Barracks, treine 3 Militia e envie-os com o Scout para pressionar o adversário.", check: { kind: "unit", age: "dark", terms: ["militia"], minimum: 3 } },
      { id: "drush-fc-feudal", phase: "Dark Age", villagerMarker: "28", title: "Economia e Feudal Age", description: "Faça Loom e avance para Feudal Age. Evite prolongar o investimento militar nessa fase.", check: { kind: "age", age: "feudal" } },
      { id: "drush-fc-castle", phase: "Feudal Age", villagerMarker: "30", title: "Market, Blacksmith e Castle Age", description: "Mantenha a transição econômica e avance cedo para Castle Age, aproveitando o tempo comprado pelo Drush.", check: { kind: "fast-castle" } },
    ],
  },
  {
    id: "fire-galleys-archers",
    category: "Water Maps",
    categoryPt: "Mapas de água",
    titleOriginal: "Fire Galleys and Archers",
    titlePt: "Fire Galleys e Archers",
    difficulty: "Intermediate",
    difficultyPt: "Intermediária",
    description: "Pressione em terra com Archers enquanto mantém o controle da água com Fire Galleys e sustenta a economia com Fishing Ships.",
    sourceUrl: "https://aoecompanion.com/build-guides/fire-galleys-and-archers",
    steps: [
      ...commonOpening,
      { id: "water-fishing-dock", phase: "Dark Age", villagerMarker: "12", title: "Dock e Fishing Ships", description: "Construa um Dock perto de Deep Fish e produza Fishing Ships para acelerar a economia de alimento.", check: { kind: "unit", age: "dark", terms: ["fishing ship"], minimum: 2 } },
      { id: "water-feudal", phase: "Dark Age", villagerMarker: "21", title: "Feudal Age e estruturas", description: "Pesquise Loom, avance à Feudal Age, adicione segundo Lumber Camp, Mining Camp e Barracks.", check: { kind: "age", age: "feudal" } },
      { id: "water-fire-galley", phase: "Feudal Age", title: "Fire Galley", description: "Produza Fire Galley no Dock para disputar o controle da água.", check: { kind: "unit", age: "feudal", terms: ["fire galley"], minimum: 1 } },
      { id: "water-archers", phase: "Feudal Age", title: "Duas Archery Ranges e Archers", description: "Construa House e 2 Archery Ranges perto do Barracks, produza Archers e pesquise Fletching.", check: { kind: "unit", age: "feudal", terms: ["archer"], minimum: 2 } },
    ],
  },
  {
    id: "win-water",
    category: "Water Maps",
    categoryPt: "Mapas de água",
    titleOriginal: "Win Water",
    titlePt: "Dominar a água",
    difficulty: "Intermediate",
    difficultyPt: "Intermediária",
    description: "Invista pesado em água para construir uma forte economia de Fishing Ships e manter o controle naval, enquanto protege a base em terra.",
    sourceUrl: "https://aoecompanion.com/build-guides/win-water",
    steps: [
      ...commonOpening,
      { id: "win-water-dock", phase: "Dark Age", villagerMarker: "12", title: "Dock e Fishing Ships", description: "Construa Dock e Houses perto da água; produza 4 Fishing Ships para coletar Deep Fish.", check: { kind: "building", age: "dark", terms: ["dock"], minimum: 1 } },
      { id: "win-water-fishing", phase: "Dark Age", title: "Economia de pesca", description: "Mantenha pelo menos 4 Fishing Ships em produção/coleta e proteja o acesso à água.", check: { kind: "unit", age: "dark", terms: ["fishing ship"], minimum: 4 } },
      { id: "win-water-wall", phase: "Dark Age", villagerMarker: "21", title: "Loom, Feudal Age e paredes", description: "Pesquise Loom, avance para Feudal Age e feche acessos terrestres com paredes, já que o foco principal será a água.", check: { kind: "walls" } },
      { id: "win-water-fire-galleys", phase: "Feudal Age", title: "Fire Galleys e expansão naval", description: "Pesquise Double-Bit Axe, produza Fire Galleys e expanda para segundo/terceiro Dock conforme a disputa pela água.", check: { kind: "unit", age: "feudal", terms: ["fire galley"], minimum: 2 } },
    ],
  },
];

export const BUILD_GUIDE_CATEGORIES = [
  "Feudal Rush",
  "Fast Castle (FC)",
  "Dark Age Rush (drush)",
  "Water Maps",
] as const;

export function getBuildGuide(id: string | null | undefined): BuildGuide | null {
  return id ? AOE2_BUILD_GUIDES.find((guide) => guide.id === id) ?? null : null;
}
