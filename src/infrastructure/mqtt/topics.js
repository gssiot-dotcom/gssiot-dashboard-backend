const BASE = 'GSSIOT/01030369081'

const topics = {
	all: [
		`${BASE}/GATE_PUB/+`,
		`${BASE}/GATE_RES/+`,
		`${BASE}/GATE_ANG/+`,
		`${BASE}/GATE_FORM/+`,
	],
	nodePrefix: `${BASE}/GATE_PUB/`,
	anglePrefix: `${BASE}/GATE_ANG/`,
	formPrefix: `${BASE}/GATE_FORM/`,
	gwResPrefix: `${BASE}/GATE_RES/`,
}

module.exports = { topics }
