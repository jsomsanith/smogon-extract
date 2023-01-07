import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

interface Move {
	move: string;
}

interface EVs {
	hp: number;
	atk: number;
	def: number;
	spa: number;
	spd: number;
	spe: number;
}

interface IVs {
	hp: number;
	atk: number;
	def: number;
	spa: number;
	spd: number;
	spe: number;
}

interface Moveset {
	name: string;
	pokemon: string;
	abilities: string[];
	items: string[];
	teratypes: string[];
	moveslots: Move[][];
	evconfigs: EVs[];
	ivconfigs: IVs[];
	natures: string[];
}

interface SmogonBuild {
	format: string;
	movesets: Moveset[];
}

interface BRBuild {
	name?: string;
	recommendation?: string;
	nature: string;
	evs: {
		HP: number;
		ATK: number;
		DEF: number;
		SPE: number;
		SPA: number;
		SPD: number;
	};
	ivs: {
		HP: number;
		ATK: number;
		DEF: number;
		SPE: number;
		SPA: number;
		SPD: number;
	};
	ability: string;
	teraType: string;
	heldItem: string;
	moveset: string[];
}

async function download(version) {
	console.log(`Running ${version}`);

	const resultFolder = './result';
	if (!fs.existsSync(resultFolder)) {
		fs.mkdirSync(resultFolder);
	}

	const res = await fetch(`https://www.smogon.com/dex/${version}/pokemon/`);
	const smogonIndexDom = await res.text();
	const { window } = new JSDOM(smogonIndexDom, { runScripts: 'dangerously' });
	const { dexSettings } = window;
	window.close(); // close the jsdom

	const brBuilds = [];
	const eligiblePokemons = dexSettings.injectRpcs[1][1].pokemon
		.filter(({ isNonstandard }) => isNonstandard === 'Standard')
		.filter(({ oob }) => oob && oob.evos.length === 0);

	for (const { name } of eligiblePokemons) {
		console.log(`${version}: Extracting ${name}`);
		const pkmUrl = `https://www.smogon.com/dex/sv/pokemon/${name
			.toLowerCase()
			.replace(/\s/g, '-')}/`;

		const res = await fetch(pkmUrl);
		const smogonPkmDom = await res.text();
		const { window } = new JSDOM(smogonPkmDom, { runScripts: 'dangerously' });
		const { dexSettings } = window;

		if (!dexSettings) {
			console.log(`${version}: No dex settings !`, pkmUrl);
			continue;
		}

		const pkmBuilds = { name, builds: [] };
		brBuilds.push(pkmBuilds);
		dexSettings.injectRpcs[2][1].strategies.forEach(({ format, movesets }: SmogonBuild) => {
			movesets.forEach(
				({
					name,
					pokemon,
					abilities,
					items,
					teratypes,
					moveslots,
					evconfigs,
					ivconfigs,
					natures,
				}) => {
					const build: BRBuild = {
						name: `${pokemon} - ${format} - ${name}`,
						nature: natures[0],
						evs: {
							HP: evconfigs[0].hp,
							ATK: evconfigs[0].atk,
							DEF: evconfigs[0].def,
							SPE: evconfigs[0].spe,
							SPA: evconfigs[0].spa,
							SPD: evconfigs[0].spd,
						},
						ivs: {
							HP: ivconfigs[0] ? ivconfigs[0].hp : 31,
							ATK: ivconfigs[0] ? ivconfigs[0].atk : 31,
							DEF: ivconfigs[0] ? ivconfigs[0].def : 31,
							SPE: ivconfigs[0] ? ivconfigs[0].spe : 31,
							SPA: ivconfigs[0] ? ivconfigs[0].spa : 31,
							SPD: ivconfigs[0] ? ivconfigs[0].spd : 31,
						},
						ability: abilities[0],
						teraType: teratypes[0],
						heldItem: items[0],
						moveset: moveslots.map(moves => moves[0].move.replace(/\s/g, '').replace(/-/g, '')),
					};

					pkmBuilds.builds.push(build);
				},
			);
		});
		window.close(); // close the jsdom
	}

	const brDexFilePath = path.join(resultFolder, `${version}.json`);
	fs.writeFileSync(brDexFilePath, JSON.stringify(brBuilds, null, 2));
}

(async () => {
	['ss', 'sv'].forEach(async version => await download(version));
})();
