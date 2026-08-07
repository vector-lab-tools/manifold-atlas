/**
 * Calibration corpora.
 *
 * These texts exist to measure the shape of a model's embedding space
 * before any probe is run against it. Nothing here is a probe: the
 * sentences are deliberately mundane, and the political and evaluative
 * registers are kept out on purpose, because the point is to establish
 * where the space sits when nothing interesting is being asked of it.
 *
 * Three strata, because a single "random pair" number is not enough:
 *
 *  - SHORT_DECLARATIVE  subject-copula-predicate, five to eight words.
 *                       Matched in length and syntax to the statements
 *                       the Negation Gauge takes. This is the stratum
 *                       whose floor should be quoted alongside a
 *                       negation result. A floor measured on long prose
 *                       is measuring a different thing.
 *
 *  - NEUTRAL_PROSE      longer sentences, varied syntax. Gives the floor
 *                       for operations that embed paragraphs or
 *                       multi-clause text (Semantic Sectioning, Text
 *                       Vectorisation).
 *
 *  - TOPICAL_PAIRS      two sentences on the same subject with no shared
 *                       content words and no shared structure. Gives the
 *                       ceiling: where mere aboutness lands, before any
 *                       claim is shared. A result below this is not
 *                       registering anything beyond topic.
 *
 * CORPUS_VERSION is part of the cache key. Bump it whenever any string
 * below changes, or stored calibrations will be read against a corpus
 * they were not computed from.
 */

export const CORPUS_VERSION = 1;

/**
 * Short declarative sentences, five to eight words, subject-copula-
 * predicate. No shared content words between any two, so pairwise
 * cosine here reflects the geometry of the register rather than any
 * lexical overlap.
 */
export const SHORT_DECLARATIVE: string[] = [
  "The kettle is empty",
  "That envelope was sealed",
  "The bridge is closed today",
  "Her bicycle needs new tyres",
  "The library opens at nine",
  "This paint is still wet",
  "The harvest came in late",
  "My passport expired last spring",
  "The corridor smells of bleach",
  "Those curtains are too heavy",
  "The lift stopped on four",
  "His handwriting is very small",
  "The oven runs slightly hot",
  "That fence needs repainting soon",
  "The tide goes out early",
  "This carpet was laid badly",
  "The postman arrived before dawn",
  "Her cousin lives in Leeds",
  "The gutter is full of leaves",
  "That recipe calls for saffron",
  "The generator failed twice yesterday",
  "This bench was carved by hand",
  "The ferry leaves every hour",
  "My watch loses two minutes",
  "The greenhouse lost three panes",
  "That road floods every winter",
  "The chimney was swept in March",
  "His allotment grows mostly beans",
  "The signal fades near the tunnel",
  "This mattress is far too soft",
  "The orchard was planted in 1912",
  "That window faces due north",
  "The boiler needs bleeding again",
  "Her flight lands after midnight",
  "The pond froze over completely",
  "This cupboard sticks in humidity",
  "The scaffolding came down Tuesday",
  "That printer jams on thick paper",
  "The path narrows past the gate",
  "His toolbox is missing a spanner",
  "The reservoir is unusually low",
  "This wallpaper hides a crack",
  "The bakery closes on Mondays",
  "That staircase creaks near the top",
  "The awning tore in the gale",
  "My umbrella blew inside out",
  "The hedgerow needs cutting back",
  "This doorframe is slightly warped",
  "The tram runs until eleven",
  "That skylight leaks in heavy rain",
  "The compost heap has settled",
  "His spectacles were left behind",
  "The pavement heaves near the roots",
  "This jar has no lid",
  "The weathervane points south-west",
  "That drawer holds spare fuses",
  "The canal towpath is muddy",
  "Her rucksack weighs almost nothing",
  "The radiator never gets warm",
  "This gatepost is coming loose",
  "The lighthouse was automated years ago",
  "That crossing has no barrier",
  "The freezer defrosted overnight",
  "His notebook is nearly full",
];

/**
 * Longer neutral sentences with varied syntax. Used as the floor for
 * operations that embed prose rather than short claims.
 */
export const NEUTRAL_PROSE: string[] = [
  "The engineers replaced the culvert during the low-water season, which delayed the resurfacing by several weeks.",
  "A small colony of swifts returns to the eaves each year, arriving within a few days of the same date.",
  "Because the archive was catalogued by two different hands, the shelf marks follow no consistent scheme.",
  "The recipe survives in three manuscript versions, none of which specifies the quantity of butter.",
  "Rainfall gauges installed along the ridge recorded almost nothing for eleven consecutive weeks.",
  "When the mill was converted the original beams were left exposed, though most of the machinery was sold.",
  "Passengers boarding at the rear were asked to move forward, since the front doors would not open.",
  "The survey team worked from a boat, taking depth readings at fifty-metre intervals across the estuary.",
  "Although the bindery closed in the 1970s, its stamps and tools were kept by a former apprentice.",
  "A fault in the cooling loop shut the plant down twice before anyone traced it to a blocked filter.",
  "The choir rehearses in the side chapel because the nave produces an unmanageable amount of echo.",
  "Seed stored in the cold vault remains viable for decades, provided the humidity is tightly controlled.",
  "He kept the accounts in pencil, ruling each column by hand and totalling them at the end of the week.",
  "The footpath was diverted around the quarry, adding nearly a mile to what had been a direct route.",
  "Restorers found an earlier layer of plaster beneath the panelling, decorated with a simple repeating motif.",
  "Deliveries arrive before the shop opens, so the crates are stacked in the yard until someone unlocks the door.",
  "The observatory logs note poor seeing on most nights that winter, with only four usable sessions in January.",
  "Timber cut from the eastern slope was found to be denser, and was reserved for the load-bearing frames.",
  "After the flood the parish records were dried page by page and rehoused in acid-free folders.",
  "The tram depot still has its original turntable, though it has not been rotated since the line closed.",
  "Visitors are asked not to touch the models, whose paint has become brittle with age and handling.",
  "The bell was recast twice, first after a crack appeared and again when the tone proved unsatisfactory.",
  "Fieldwork was suspended in August because the ground had hardened beyond what the augers could manage.",
  "A hedge laid in the traditional style will hold stock without wire, but it needs cutting every seven years.",
  "The typesetter worked from a marked-up carbon copy, which accounts for several of the odder misreadings.",
  "Boats moored on the outside of the pontoon take the worst of the swell when the wind turns westerly.",
  "The kiln reached temperature more slowly than expected, and the first firing had to be abandoned.",
  "Copies were circulated among a small readership, most of whom annotated their own margins heavily.",
  "The lock gates are opened by hand, a job that takes two people and about a quarter of an hour.",
  "Soil samples taken from the lower field showed a marked difference in acidity from those taken uphill.",
  "The apprentice ground her own tools, since the workshop kept no stock of the smaller gouges.",
  "Sheep were moved off the common in October, earlier than usual, because the grazing had run out.",
  "The transcription omits several marginal notes, which the editor judged to be in a much later hand.",
  "A temporary bridge carried the traffic for two summers while the masonry arch was taken apart and rebuilt.",
  "The projector needed rethreading between reels, and the interval was timed around that rather than the story.",
  "Sediment cores drawn from the lake bed preserve a clear annual banding for roughly nine hundred years.",
  "Windows on the north side were bricked up at some point, probably to reduce heat loss rather than tax.",
  "The society met monthly in a room above a bank, and its minutes run without a gap from 1884 to 1939.",
  "Instruments were carried up in sections and assembled on site, which took most of the first week.",
  "The path becomes indistinct above the treeline, where cairns mark the route at irregular intervals.",
  "Salvage crews recovered the boiler intact, though almost everything forward of it had been crushed.",
  "The dye was made in small batches, and no two lengths of cloth from that period match exactly.",
  "Her fieldnotes are written on both sides of the paper, often in two directions on the same page.",
  "The chapel roof was replaced in slate, departing from the stone tiles that had covered it since the rebuild.",
  "Water is drawn from a borehole rather than the mains, and is tested for hardness every quarter.",
  "The scheme was abandoned after the survey showed the ground would not bear the intended load.",
  "Printed sheets were hung to dry across the width of the room, which limited how many could be run at once.",
  "The station clock was kept three minutes fast, a local practice that survived the arrival of the telegraph.",
];

/**
 * Same-subject pairs with no shared content words and no shared
 * structure. Each entry is a two-element tuple; the pair cosine gives
 * the ceiling of mere topical relatedness.
 */
export const TOPICAL_PAIRS: Array<[string, string]> = [
  ["The statute was passed last year", "Parliament sat late through the summer"],
  ["The kettle is empty", "Someone left the tap running"],
  ["The bridge is closed today", "Traffic has been diverted through the village"],
  ["Her bicycle needs new tyres", "The chain came off on the hill"],
  ["The library opens at nine", "Most of the reading room is taken by students"],
  ["The harvest came in late", "Wheat prices fell sharply in September"],
  ["The ferry leaves every hour", "Sailings are cancelled when the swell is high"],
  ["The greenhouse lost three panes", "Tomatoes ripened badly that summer"],
  ["The boiler needs bleeding again", "Radiators upstairs stay cold all morning"],
  ["The reservoir is unusually low", "A hosepipe ban was announced in July"],
  ["The bakery closes on Mondays", "Sourdough sells out before eleven"],
  ["The tram runs until eleven", "Night buses replace the service after that"],
  ["The lighthouse was automated years ago", "Keepers' cottages were sold to holiday lets"],
  ["The freezer defrosted overnight", "Everything in it had to be thrown away"],
  ["The orchard was planted in 1912", "Old varieties are grafted onto new rootstock"],
  ["The canal towpath is muddy", "Narrowboats queue at the flight of locks"],
  ["The scaffolding came down Tuesday", "Rendering on the front elevation is finished"],
  ["The compost heap has settled", "Beds were mulched before the first frost"],
  ["That road floods every winter", "Drainage ditches have not been cleared for years"],
  ["The chimney was swept in March", "Woodsmoke hangs low over the terrace"],
  ["The signal fades near the tunnel", "Reception is poor throughout the valley"],
  ["The pond froze over completely", "Herons went hungry for most of February"],
  ["The generator failed twice yesterday", "Power was restored just before midnight"],
  ["The archive was catalogued by two hands", "Shelf marks follow no consistent scheme"],
];

/** Every text the calibration run needs to embed, in a stable order. */
export function calibrationTextList(): string[] {
  return [
    ...SHORT_DECLARATIVE,
    ...NEUTRAL_PROSE,
    ...TOPICAL_PAIRS.flat(),
  ];
}

/** Index ranges of each stratum within calibrationTextList(). */
export function stratumRanges() {
  const shortStart = 0;
  const shortEnd = SHORT_DECLARATIVE.length;
  const proseStart = shortEnd;
  const proseEnd = proseStart + NEUTRAL_PROSE.length;
  const topicalStart = proseEnd;
  const topicalEnd = topicalStart + TOPICAL_PAIRS.length * 2;
  return {
    shortDeclarative: [shortStart, shortEnd] as [number, number],
    neutralProse: [proseStart, proseEnd] as [number, number],
    topical: [topicalStart, topicalEnd] as [number, number],
  };
}

export const CALIBRATION_TEXT_COUNT = calibrationTextList().length;
