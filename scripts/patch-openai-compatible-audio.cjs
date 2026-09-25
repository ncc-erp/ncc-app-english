const fs = require('fs');
const p = 'node_modules/@ai-sdk/openai-compatible/dist/index.js';
try {
	let s = fs.readFileSync(p, 'utf8');
	// Only patch if still in original form (wav/mp3 only)
	if (!s.includes('case "audio/webm"')) {
		s = s.replace(
			'    case "audio/wav":\n      return "wav";\n    case "audio/mp3":\n    case "audio/mpeg":\n      return "mp3";',
			'    case "audio/wav":\n      return "wav";\n    case "audio/webm":\n      return "webm";\n    case "audio/ogg":\n    case "audio/opus":\n    case "audio/x-opus":\n      return "ogg";\n    case "audio/mp3":\n    case "audio/mpeg":\n      return "mp3";'
		);
		fs.writeFileSync(p, s);
	}
} catch (e) {}
