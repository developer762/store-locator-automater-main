const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.join(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT_DIR, 'casa-mexico-locations.json');

// Exact TSV data provided by user (52 rows)
const rawTsvData = `CMT-2026Q1-013	Parry's Pizzeria & Taphouse	10485 W McDowell Rd #107	Avondale	AZ	85392	Bar / Restaurant	+1 623-274-3031	https://parryspizza.com/	AZ Distributor	AZ	33.46402	-112.28581
CMT-2026Q1-009	Janey's Coffeehouse	6602 E Cave Creek Rd	Cave Creek	AZ	85331	Bar / Restaurant	+1 480-575-6885	https://janeyscoffee.com/	AZ Distributor	AZ	33.83381	-111.93849
CMT-2026Q1-015	Quick N Shine Car Wash	777 S Gilbert Rd	Gilbert	AZ	85296	Retail	+1 480-892-1130	https://www.quicknshinecarwash.com/	AZ Distributor	AZ	33.33603	-111.78932
CMT-2026Q1-018	Skyline Liquor	9950 E Broadway Rd	Mesa	AZ	85208	Retail	+1 480-986-9954	https://skylinebroadway.com/	AZ Distributor	AZ	33.40812	-111.61584
CMT-2026Q1-024	U-Stop	5207 E Main St	Mesa	AZ	85205	Retail	+1 480-325-6545	https://ustopliquor.godaddysites.com/	AZ Distributor	AZ	33.41548	-111.71797
CMT-2026Q1-003	Cellar's Fine Wine And Spirits	914 E Camelback Rd Suite 2	Phoenix	AZ	85014	Retail	+1 602-265-9463		AZ Distributor	AZ	33.50958	-112.06137
CMT-2026Q1-007	Hula's Modern Tiki 7th Street	5114 N 7th St Suite 1	Phoenix	AZ	85014	Bar / Restaurant	+1 602-265-8454	https://www.hulasmoderntiki.com/	AZ Distributor	AZ	33.51143	-112.06511
CMT-2026Q1-011	Milk & Honey	888 N 1st Ave Suite 112	Phoenix	AZ	85003	Bar / Restaurant	+1 602-317-5030	https://milkandhoneyphx.com/	AZ Distributor	AZ	33.45765	-112.07522
CMT-2026Q1-014	Pedal Haus Brewery-Phoenix	214 E Roosevelt St Suite 4	Phoenix	AZ	85004	Bar / Restaurant	+1 623-213-8229	https://www.pedalhausbrewery.com/phoenix-location	AZ Distributor	AZ	33.45882	-112.0706
CMT-2026Q1-016	Red Devil Italian Restaurant & Pizzeria	3102 E McDowell Rd	Phoenix	AZ	85008	Bar / Restaurant	+1 602-267-1036	https://www.reddevilrestaurant.com/	AZ Distributor	AZ	33.46602	-112.01571
CMT-2026Q1-017	Rosso Italian	2 E Jefferson St #113	Phoenix	AZ	85004	Bar / Restaurant	+1 602-218-6001	https://rossoitalian.com/	AZ Distributor	AZ	33.44744	-112.07321
CMT-2026Q1-019	Sunshine Market	2302 N 12th St	Phoenix	AZ	85006	Retail	+1 602-253-8952	http://sunshinemarket.shop	AZ Distributor	AZ	33.47327	-112.0568
CMT-2026Q1-022	The Mighty Axe	5410 E High St Suite 102	Phoenix	AZ	85054	Bar / Restaurant	+1 844-444-4120	https://themightyaxe.com/	AZ Distributor	AZ	33.67599	-111.96461
CMT-2026Q1-006	Goodwood Tavern	7330 E Stetson Dr	Scottsdale	AZ	85251	Bar / Restaurant	+1 480-990-2388	https://goodwoodtavern.com/	AZ Distributor	AZ	33.4998	-111.9231
CMT-2026Q1-004	Devil's Liquor	1858 E Apache Blvd	Tempe	AZ	85281	Retail	+1 480-968-2377	https://www.facebook.com/devilsliquor6/	AZ Distributor	AZ	33.41653	-111.93972
CMT-2026Q1-021	The Craftsman	1006 E Warner Rd	Tempe	AZ	85284	Bar / Restaurant	+1 480-499-0499		AZ Distributor	AZ	33.33541	-111.92718
CMT-2026Q1-023	Top's Liquor	403 W University Dr #104	Tempe	AZ	85281	Retail	+1 480-967-5643	http://www.topsliquors.com/	AZ Distributor	AZ	33.42149	-111.94485
CMT-2026Q1-001	Axis Food Mart	1540 E Broadway Blvd	Tucson	AZ	85719	Retail	+1 520-628-1700		AZ Distributor	AZ	32.22131	-110.94889
CMT-2026Q1-002	Baja Mar	3541 S 12th Ave	Tucson	AZ	85714	Bar / Restaurant	+1 520-274-7225		AZ Distributor	AZ	32.18252	-110.97748
CMT-2026Q1-005	Fortuna Hills Liquor LLC	11525 S Fortuna Rd	Yuma	AZ	85367	Retail	+1 928-919-7096		AZ Distributor	AZ	32.66138	-114.44403
CMT-2026Q1-008	J.T. Prime Kitchen	714 E 32nd St	Yuma	AZ	85365	Bar / Restaurant	+1 928-955-0076	https://www.jtprimekitchen.com/	AZ Distributor	AZ	32.66951	-114.61326
CMT-2026Q1-010	Mesa Del Sol Golf Club	12213 Calle Del Cid	Yuma	AZ	85367	Bar / Restaurant	+1 928-342-1283		AZ Distributor	AZ	32.65185	-114.40673
CMT-2026Q1-025	Yuma Liquor	2411 S 4th Ave	Yuma	AZ	85364	Retail	+1 928-483-5522		AZ Distributor	AZ	32.68369	-114.62453
CMT-2026Q1-030	Mr Tempo Bakersfield	7777 Rosedale Hwy	Bakersfield	CA	93308	Bar / Restaurant	+1 661-548-3676	https://menus.mrtempo.com/bakersfield	Casa Mexico Direct (CA)	CA	35.38345	-119.08558
CMT-2026Q1-032	Novikov Beverly Hills	257 N Canon Dr	Beverly Hills	CA	90210	Bar / Restaurant	+1 310-300-0090	https://novikovbeverly.com/	Casa Mexico Direct (CA)	CA	34.06856	-118.39895
CMT-2026Q1-028	Liquor Corner Inc	465 W Broadway	Glendale	CA	91204	Retail	+1 818-449-7777		Casa Mexico Direct (CA)	CA	34.1469	-118.26321
CMT-2026Q1-033	Party Time Liquor - Granada Hills	11902 Balboa Blvd	Granada Hills	CA	91344	Retail	+1 818-360-1777		Casa Mexico Direct (CA)	CA	34.28638	-118.50142
CMT-2026Q1-027	Frank's Liquor - Long Beach	919 E Broadway	Long Beach	CA	90802	Retail	+1 562-951-3549		Casa Mexico Direct (CA)	CA	33.76917	-118.18166
CMT-2026Q1-035	Ramirez Liquor - Olympic	2765 E Olympic Blvd	Los Angeles	CA	90023	Retail	+1 323-266-2337	https://ramirezliquor.com/	Casa Mexico Direct (CA)	CA	34.02387	-118.21809
CMT-2026Q1-034	Raleys Bel Air	4061 Gateway Park Blvd	Sacramento	CA	95834	Retail	+1 916-928-7700	https://www.raleys.com/	Casa Mexico Direct (CA)	CA	38.64271	-121.50571
CMT-2026Q1-026	Davanti Enoteca San Diego	1655 India St	San Diego	CA	92101	Bar / Restaurant	+1 619-237-9606	https://www.davantienotecalittleitaly.com/	Casa Mexico Direct (CA)	CA	32.72268	-117.1681
CMT-2026Q1-031	Mr. Tempo Little Italy -Kqc	1490 Kettner Blvd	San Diego	CA	92101	Bar / Restaurant	+1 619-756-7864	https://kingandqueencantina.com/	Casa Mexico Direct (CA)	CA	32.72074	-117.16934
CMT-2026Q1-036	Vallarta Supermarkets - Sylmar	12881 Bradley Ave	Sylmar	CA	91342	Retail	+1 818-898-0088	https://vallartasupermarkets.com/	Casa Mexico Direct (CA)	CA	34.30445	-118.45876
CMT-2026Q1-029	Liquor Depot	27911 Jefferson Ave.	Temecula	CA	92590	Retail	+1 951-587-2266		Casa Mexico Direct (CA)	CA	33.50986	-117.15637
CMT-2026Q1-038	Angelo Caputos Addison	510 W Lake St	Addison	IL	60101	Retail	+1 630-543-0151	https://www.shopcaputos.com/	Espiritus (IL)	IL-Espiritus	41.93983	-88.00136
CMT-2026Q1-058	Garfield's Beverage Warehouse - Barringt	340 W Northwest Hwy	Barrington	IL	60010	Retail	+1 847-387-3676	https://garfieldsbeverage.com/	Espiritus (IL)	IL-Espiritus	42.16167	-88.14242
CMT-2026Q1-039	Angelo Caputos Bloomingdale	166 E Lake St	Bloomingdale	IL	60108	Retail	+1 630-924-0900	https://www.shopcaputos.com/	Espiritus (IL)	IL-Espiritus	41.95593	-88.07396
CMT-2026Q1-067	Korbakes Wine & Liquor	12747 S Western Ave	Blue Island	IL	60406	Retail	+1 708-385-3296	http://korbakesliquors.com/	Espiritus (IL)	IL-Espiritus	41.66116	-87.67977
CMT-2026Q1-076	Tucci's Italian	1560 IL-50	Bourbonnais	IL	60914	Bar / Restaurant	+1 815-929-1875	https://www.tuccisitalian.com/	Espiritus (IL)	IL-Espiritus	41.18098	-87.85166
CMT-2026Q1-053	Epic Wine & Spirits (Brodway)	4411-13 N Broadway	Chicago	IL	60640	Retail	+1 773-809-2121		Espiritus (IL)	IL-Espiritus	41.96222	-87.65519
CMT-2026Q1-057	Foremost Liquors Central & Milwaukee	5301 N Milwaukee Ave	Chicago	IL	60630	Retail	+1 773-631-2600		Espiritus (IL)	IL-Espiritus	41.97744	-87.76879
CMT-2026Q1-062	Golden Leaf Liquors Irving Park Road	3652 W Irving Park Rd	Chicago	IL	60618	Retail	+1 773-478-4195		Espiritus (IL)	IL-Espiritus	41.95395	-87.71988
CMT-2026Q1-064	Hops & Grapes	6816 N Sheridan Rd	Chicago	IL	60626	Retail	+1 773-809-8938	https://hopsandgrape.com/	Espiritus (IL)	IL-Espiritus	42.00588	-87.66137
CMT-2026Q1-065	J & B Food & Liquors Inc.	1957 W Lawrence Ave	Chicago	IL	60625	Retail	+1 773-784-8580		Espiritus (IL)	IL-Espiritus	41.96853	-87.67868
CMT-2026Q1-069	Purple Pig	444 N Michigan Ave Upper Level	Chicago	IL	60611	Bar / Restaurant	+1 312-464-1744	https://thepurplepigrestaurantgroup.com/	Espiritus (IL)	IL-Espiritus	41.89071	-87.62469
CMT-2026Q1-070	R&s Liquors - Chicago	308 E 75th St	Chicago	IL	60619	Retail	+1 773-994-0426		Espiritus (IL)	IL-Espiritus	41.75857	-87.61778
CMT-2026Q1-071	Rabbits	4945 W Foster Ave	Chicago	IL	60630	Bar / Restaurant	+1 773-736-5766	https://rabbitsbar.com/	Espiritus (IL)	IL-Espiritus	41.97516	-87.75216
CMT-2026Q1-072	Rupee Wine & Spirits	4812 N Broadway	Chicago	IL	60640	Retail	+1 773-809-0936	https://rupeewinespirits.com/	Espiritus (IL)	IL-Espiritus	41.96929	-87.66007
CMT-2026Q1-073	Sky Beverage Depot	4635 N Broadway	Chicago	IL	60640	Retail	+1 773-809-8909	https://hopsandgrape.com/	Espiritus (IL)	IL-Espiritus	41.96702	-87.65863
CMT-2026Q1-074	Su Casa	49 E Ontario St	Chicago	IL	60611	Bar / Restaurant	+1 312-943-4041	https://sucasamexican.com/	Espiritus (IL)	IL-Espiritus	41.8931	-87.62622
CMT-2026Q1-075	Town Armanetti Beverage Mart	10000 S Western Ave	Chicago	IL	60643	Retail	+1 773-239-2800		Espiritus (IL)	IL-Espiritus	41.71174	-87.68189
CMT-2026Q1-059	Garfield's Beverage Warehouse - Crystal L	320 W Virginia St	Crystal Lake	IL	60014	Retail	+1 815-459-4050	https://garfieldsbeverage.com/	Espiritus (IL)	IL-Espiritus	42.23149	-88.33217`;

function normalizePremiseType(category) {
  const norm = String(category || '').toLowerCase();
  if (norm.includes('bar') || norm.includes('restaurant')) return 'bar-restaurant';
  return 'retail';
}

function parseTsv(tsvString) {
  const lines = tsvString.trim().split('\n').filter(Boolean);
  return lines.map(line => {
    const parts = line.split('\t').map(p => p.trim());
    const fullAddress = `${parts[2]}, ${parts[3]}, ${parts[4]} ${parts[5]}`;
    return {
      id: parts[0],
      name: parts[1],
      address: fullAddress,
      city: parts[3],
      state: parts[4],
      postalCode: parts[5],
      type: normalizePremiseType(parts[6]),
      phone: parts[7] || '',
      website: parts[8] || '',
      distributor: parts[9] || '',
      territory: parts[10] || '',
      latitude: Number(parts[11]),
      longitude: Number(parts[12]),
      placeId: parts[0],
      cases: null,
      bottlings: 'Blanco, Reposado, Anejo'
    };
  });
}

function generateExactFeed() {
  const locations = parseTsv(rawTsvData);

  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    spreadsheetId: '1VnQcAcYE0LPmmmAIXCSH71V_RTUIZbW6',
    sheetName: 'Store Locator',
    count: locations.length,
    skipped: {
      notReady: 0,
      invalidCoordinates: 0,
      duplicate: 0
    },
    locations: locations
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`\n==================================================`);
  console.log(` EXACT GOOGLE SHEET FEED GENERATED`);
  console.log(` Rows Processed: ${payload.count}`);
  console.log(` Written To: casa-mexico-locations.json`);
  console.log(`==================================================\n`);
}

generateExactFeed();
