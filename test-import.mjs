import { Zap } from './node_modules/lucide-react/dist/esm/lucide-react.js';
console.log('Zap type:', typeof Zap);
if (typeof Zap === 'undefined') {
    console.error('Zap is undefined!');
    process.exit(1);
} else {
    console.log('Zap is valid.');
}
