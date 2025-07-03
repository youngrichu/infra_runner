// Quick test script for model sizing analysis
import { runModelAnalysis } from './model-sizing-tool.js';

console.log('🔧 Starting Model Size Analysis...');
console.log('This will analyze all your new models and calculate the exact scale factors needed.');

runModelAnalysis()
    .then(({ results, config }) => {
        console.log('\n🎉 Analysis Complete!');
        console.log('The configuration object above contains all the scale factors needed.');
        console.log('You can now safely integrate these models without size issues.');
    })
    .catch(error => {
        console.error('❌ Analysis failed:', error);
    });