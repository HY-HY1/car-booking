import type { SizeClass } from "../booking/config";

// The usual size class for each model in catalog.ts, so the booking form
// can pre-select it. Rough rules: superminis are small; family hatchbacks,
// compact saloons, sports cars and small crossovers are medium; estates,
// big saloons and SUVs are large; 7-seaters, big 4x4s, pickups and vans are
// XL. Where a model comes as both hatch and estate, the hatch wins: the
// customer can always pick a bigger size.

const SIZES: Record<string, Partial<Record<SizeClass, string[]>>> = {
  Abarth: { small: ["124 Spider", "500", "500e", "595", "695"], medium: ["600e"] },
  "Alfa Romeo": {
    small: ["MiTo"],
    medium: ["147", "156", "4C", "Brera", "Giulietta", "GT", "Junior", "Spider"],
    large: ["159", "Giulia", "Stelvio", "Tonale"],
  },
  Alpine: { small: ["A110", "A290"] },
  "Aston Martin": {
    medium: ["DB7", "DB9", "DB11", "DB12", "DBS", "Vanquish", "Vantage", "Virage"],
    large: ["DBX", "Rapide"],
  },
  Audi: {
    small: ["A1", "A2", "S1"],
    medium: ["A3", "A4", "A5", "Q2", "R8", "RS3", "RS5", "S3", "S4", "S5", "SQ2", "TT", "TT RS", "TTS"],
    large: [
      "A4 Allroad", "A6", "A6 Allroad", "A6 e-tron", "A7", "A8", "e-tron", "e-tron GT", "Q3", "Q4 e-tron", "Q5",
      "Q6 e-tron", "Q8", "Q8 e-tron", "RS4", "RS6", "RS7", "RS Q3", "RS Q8", "S6", "S7", "S8", "SQ5", "SQ8",
    ],
    xl: ["Q7", "SQ7"],
  },
  Bentley: { large: ["Bentayga", "Continental GT", "Continental GTC", "Flying Spur", "Mulsanne"] },
  BMW: {
    small: ["i3", "Z3", "Z4"],
    medium: [
      "1 Series", "2 Series", "2 Series Active Tourer", "2 Series Gran Coupe", "3 Series", "4 Series",
      "4 Series Gran Coupe", "i4", "i8", "M2", "M3", "M4",
    ],
    large: [
      "3 Series Gran Turismo", "5 Series", "5 Series Gran Turismo", "6 Series", "7 Series", "8 Series", "i5", "i7",
      "iX", "iX1", "iX2", "iX3", "M5", "M8", "X1", "X2", "X3", "X3 M", "X4", "X5", "X5 M", "X6", "X6 M", "XM",
    ],
    xl: ["2 Series Gran Tourer", "X7"],
  },
  BYD: {
    small: ["Dolphin Surf"],
    medium: ["Atto 2", "Dolphin", "Seal"],
    large: ["Atto 3", "Seal U", "Sealion 7"],
    xl: ["Tang"],
  },
  Caterham: { small: ["Seven"] },
  Chevrolet: {
    small: ["Aveo", "Spark"],
    medium: ["Camaro", "Corvette", "Cruze", "Trax", "Volt"],
    xl: ["Captiva", "Orlando"],
  },
  Chrysler: { small: ["Ypsilon"], medium: ["PT Cruiser"], large: ["300C"], xl: ["Grand Voyager"] },
  Citroen: {
    small: ["Ami", "C1", "C2", "C3", "DS3", "e-C3"],
    medium: ["C3 Aircross", "C3 Picasso", "C4", "C4 Cactus", "C4 X", "DS4", "e-C4", "Xsara Picasso"],
    large: ["C4 Picasso", "C5", "C5 Aircross", "C5 X", "DS5"],
    xl: [
      "Berlingo", "Dispatch", "e-Berlingo", "e-Dispatch", "Grand C4 Picasso", "Grand C4 SpaceTourer", "Nemo", "Relay",
      "SpaceTourer",
    ],
  },
  Cupra: { medium: ["Born", "Formentor", "Leon"], large: ["Ateca", "Tavascan", "Terramar"] },
  Dacia: { small: ["Logan", "Sandero", "Sandero Stepway", "Spring"], large: ["Bigster", "Duster"], xl: ["Jogger"] },
  Daihatsu: { small: ["Charade", "Copen", "Sirion"], medium: ["Terios"] },
  Dodge: { medium: ["Caliber"], large: ["Nitro"], xl: ["Journey"] },
  DS: { small: ["DS 3", "DS 3 Crossback"], medium: ["DS 4", "DS 5", "N°4"], large: ["DS 7", "DS 9", "N°8"] },
  Ferrari: {
    medium: ["296", "458", "488", "812", "California", "F8", "Portofino", "Roma", "SF90"],
    large: ["FF", "GTC4Lusso", "Purosangue"],
  },
  Fiat: {
    small: ["124 Spider", "500", "500C", "500e", "Grande Punto", "Panda", "Punto"],
    medium: ["500L", "500X", "600", "Bravo", "Qubo", "Tipo"],
    xl: ["Doblo", "Ducato", "Fiorino", "Scudo"],
  },
  Ford: {
    small: ["B-Max", "Fiesta", "Fusion", "Ka", "Ka+"],
    medium: ["C-Max", "EcoSport", "Focus", "Mustang", "Puma"],
    large: ["Bronco", "Edge", "Kuga", "Mondeo", "Mustang Mach-E"],
    xl: [
      "Explorer", "Galaxy", "Grand C-Max", "Ranger", "Ranger Raptor", "S-Max", "Tourneo Connect", "Tourneo Courier",
      "Tourneo Custom", "Transit", "Transit Connect", "Transit Courier", "Transit Custom",
    ],
  },
  Genesis: { medium: ["G70", "GV60"], large: ["G80", "GV70", "GV80"] },
  GWM: { small: ["Ora 03"], medium: ["Ora 07"] },
  Honda: {
    small: ["CR-Z", "e", "Jazz", "S2000"],
    medium: ["Civic", "Civic Type R", "e:Ny1", "FR-V", "HR-V", "Insight", "NSX"],
    large: ["Accord", "CR-V", "ZR-V"],
  },
  Hyundai: {
    small: ["Getz", "i10", "i20", "i20 N", "Inster", "ix20"],
    medium: ["Bayon", "Coupe", "i30", "i30 N", "Ioniq", "Kona", "Veloster"],
    large: ["i40", "Ioniq 5", "Ioniq 5 N", "Ioniq 6", "ix35", "Tucson"],
    xl: ["Santa Fe"],
  },
  Ineos: { xl: ["Grenadier"] },
  Infiniti: { medium: ["Q30", "Q50", "Q60", "QX30"], large: ["Q70", "QX70"] },
  Isuzu: { xl: ["D-Max"] },
  Jaecoo: { large: ["7"] },
  Jaguar: {
    medium: ["F-Type", "X-Type", "XE", "XK"],
    large: ["E-Pace", "F-Pace", "I-Pace", "S-Type", "XF", "XJ"],
  },
  Jeep: { medium: ["Avenger", "Renegade"], large: ["Cherokee", "Compass", "Grand Cherokee", "Wrangler"] },
  Kia: {
    small: ["Picanto", "Rio", "Venga"],
    medium: ["Ceed", "EV3", "Niro", "ProCeed", "Soul", "Stonic", "XCeed"],
    large: ["EV6", "Optima", "Sportage", "Stinger"],
    xl: ["Carens", "EV9", "Sorento"],
  },
  KGM: { medium: ["Tivoli"], large: ["Korando", "Torres"], xl: ["Musso", "Rexton"] },
  Lamborghini: { medium: ["Aventador", "Gallardo", "Huracan", "Revuelto", "Temerario"], large: ["Urus"] },
  "Land Rover": {
    large: ["Discovery Sport", "Freelander", "Range Rover Evoque", "Range Rover Velar"],
    xl: ["Defender", "Discovery", "Range Rover", "Range Rover Sport"],
  },
  Leapmotor: { small: ["T03"], medium: ["B10"], large: ["C10"] },
  Lexus: {
    small: ["LBX"],
    medium: ["CT", "IS", "LC", "RC", "UX"],
    large: ["ES", "GS", "LS", "NX", "RX", "RZ"],
    xl: ["LM"],
  },
  Lotus: { small: ["Elise", "Exige"], medium: ["Emira", "Evora"], large: ["Eletre", "Emeya"] },
  "Lynk & Co": { medium: ["02"], large: ["01", "08"] },
  Maserati: {
    medium: ["GranCabrio", "GranTurismo", "MC20"],
    large: ["Ghibli", "Grecale", "Levante", "Quattroporte"],
  },
  Mazda: {
    small: ["Mazda2", "MX-5"],
    medium: ["CX-3", "CX-30", "Mazda3", "MX-30", "RX-8"],
    large: ["6e", "CX-5", "CX-60", "Mazda6"],
    xl: ["CX-80", "Mazda5"],
  },
  McLaren: { medium: ["540C", "570S", "600LT", "650S", "720S", "750S", "Artura", "GT", "GTS"] },
  "Mercedes-Benz": {
    medium: ["A-Class", "AMG GT", "B-Class", "C-Class", "CLA", "CLC", "CLK", "EQA", "GLA", "SL", "SLC", "SLK"],
    large: [
      "CLS", "E-Class", "EQB", "EQC", "EQE", "EQE SUV", "EQS", "EQS SUV", "GLB", "GLC", "GLC Coupe", "GLE",
      "GLE Coupe", "M-Class", "S-Class",
    ],
    xl: ["Citan", "EQT", "EQV", "G-Class", "GLS", "Sprinter", "T-Class", "V-Class", "Vito", "X-Class"],
  },
  MG: { small: ["MG3", "MGF", "TF", "ZR"], medium: ["Cyberster", "MG4", "MG5", "ZS", "ZT"], large: ["HS", "S5"] },
  MINI: {
    small: ["Convertible", "Cooper", "Coupe", "Electric", "Hatch", "Roadster"],
    medium: ["Aceman", "Clubman", "Countryman", "Paceman"],
  },
  Mitsubishi: {
    small: ["Colt", "Mirage"],
    medium: ["ASX", "Eclipse Cross", "Lancer"],
    large: ["Outlander"],
    xl: ["L200", "Shogun", "Shogun Sport"],
  },
  Morgan: { small: ["Plus Four", "Super 3"], medium: ["Plus Six"] },
  Nissan: {
    small: ["Cube", "Micra", "Note", "Pixo"],
    medium: ["350Z", "370Z", "Almera", "GT-R", "Juke", "Leaf", "Pulsar"],
    large: ["Ariya", "Qashqai"],
    xl: ["Navara", "NV200", "Pathfinder", "Primastar", "Qashqai+2", "Townstar", "X-Trail"],
  },
  Omoda: { medium: ["5", "E5"] },
  Peugeot: {
    small: ["107", "108", "206", "207", "208", "e-208"],
    medium: ["2008", "307", "308", "e-2008", "RCZ"],
    large: ["3008", "407", "408", "508", "e-3008"],
    xl: ["5008", "Bipper", "Boxer", "e-Rifter", "Expert", "Partner", "Rifter", "Traveller"],
  },
  Polestar: { medium: ["1", "2"], large: ["3", "4"] },
  Porsche: {
    medium: ["718 Boxster", "718 Cayman", "911", "Boxster", "Cayman"],
    large: ["Cayenne", "Cayenne Coupe", "Macan", "Panamera", "Taycan"],
  },
  Renault: {
    small: ["5 E-Tech", "Clio", "Twingo", "Zoe"],
    medium: ["4 E-Tech", "Arkana", "Captur", "Megane", "Megane E-Tech", "Scenic", "Scenic E-Tech", "Symbioz"],
    large: ["Austral", "Kadjar", "Koleos", "Laguna", "Rafale"],
    xl: ["Espace", "Grand Scenic", "Kangoo", "Master", "Trafic"],
  },
  "Rolls-Royce": { large: ["Dawn", "Ghost", "Spectre", "Wraith"], xl: ["Cullinan", "Phantom"] },
  Rover: { small: ["25", "Streetwise"], medium: ["45"], large: ["75"] },
  Saab: { medium: ["9-3"], large: ["9-5"] },
  SEAT: {
    small: ["Ibiza", "Mii"],
    medium: ["Altea", "Arona", "Leon", "Toledo"],
    large: ["Ateca"],
    xl: ["Alhambra", "Tarraco"],
  },
  Skoda: {
    small: ["Citigo", "Fabia"],
    medium: ["Kamiq", "Octavia", "Rapid", "Roomster", "Scala", "Yeti"],
    large: ["Elroq", "Enyaq", "Karoq", "Superb"],
    xl: ["Kodiaq"],
  },
  Smart: { small: ["ForFour", "ForTwo"], medium: ["#1"], large: ["#3", "#5"] },
  SsangYong: { medium: ["Tivoli"], large: ["Korando"], xl: ["Musso", "Rexton", "Turismo"] },
  Subaru: {
    medium: ["BRZ", "Crosstrek", "Impreza", "WRX STI", "XV"],
    large: ["Forester", "Legacy", "Outback", "Solterra"],
  },
  Suzuki: {
    small: ["Alto", "Celerio", "Ignis", "Jimny", "Splash", "Swift"],
    medium: ["S-Cross", "Swace", "SX4", "Vitara"],
    large: ["Across", "Grand Vitara"],
  },
  Tesla: { medium: ["Model 3"], large: ["Model S", "Model Y"], xl: ["Model X"] },
  Toyota: {
    small: ["Aygo", "Aygo X", "GR Yaris", "iQ", "Yaris"],
    medium: ["Auris", "C-HR", "Corolla", "GR86", "GT86", "Prius", "Supra", "Urban Cruiser", "Yaris Cross"],
    large: ["Avensis", "bZ4X", "Camry", "Corolla Cross", "Mirai", "RAV4"],
    xl: ["Highlander", "Hilux", "Land Cruiser", "Prius+", "Proace", "Proace City", "Proace Verso", "Verso"],
  },
  Vauxhall: {
    small: ["Adam", "Agila", "Corsa", "Tigra", "Viva"],
    medium: ["Ampera", "Astra", "Cascada", "Crossland", "Frontera", "GT", "Meriva", "Mokka"],
    large: ["Antara", "Grandland", "Insignia"],
    xl: ["Combo", "Combo Life", "Movano", "Vivaro", "Vivaro Life", "Zafira", "Zafira Life", "Zafira Tourer"],
  },
  Volkswagen: {
    small: ["Beetle", "Fox", "Polo", "Up"],
    medium: [
      "Eos", "Golf", "Golf GTI", "Golf Plus", "Golf R", "Golf SV", "ID.3", "Jetta", "Scirocco", "T-Cross", "T-Roc",
      "Taigo",
    ],
    large: ["Arteon", "CC", "ID.4", "ID.5", "ID.7", "Passat", "Tiguan", "Touareg"],
    xl: [
      "Amarok", "Caddy", "California", "Caravelle", "Crafter", "ID. Buzz", "Sharan", "Tiguan Allspace", "Touran",
      "Transporter",
    ],
  },
  Volvo: {
    small: ["C30"],
    medium: ["C40", "EX30", "EX40", "S40", "V40", "XC40"],
    large: ["S60", "S80", "S90", "V50", "V60", "V70", "V90", "XC60", "XC70"],
    xl: ["EX90", "XC90"],
  },
  Xpeng: { large: ["G6", "G9", "P7"] },
};

const lookup = new Map<string, SizeClass>();
for (const [make, bySize] of Object.entries(SIZES)) {
  for (const [size, models] of Object.entries(bySize) as [SizeClass, string[]][]) {
    for (const model of models) lookup.set(`${make}|${model}`, size);
  }
}

// The usual size for a make and model, or null if we don't know it (for
// example a model typed in under "Other").
export function suggestSize(make: string, model: string): SizeClass | null {
  return lookup.get(`${make}|${model}`) ?? null;
}

// For tests: every make → size → models entry.
export const MODEL_SIZES = SIZES;
