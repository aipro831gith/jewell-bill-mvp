const fs = require('fs');
const pdf = require('pdf-parse');

async function readPdf(filePath) {
  let dataBuffer = fs.readFileSync(filePath);
  try {
    let data = await pdf(dataBuffer);
    console.log(`\n--- CONTENTS OF ${filePath} ---\n`);
    console.log(data.text);
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e);
  }
}

async function run() {
  await readPdf('C:\\Users\\ASUS\\.gemini\\antigravity\\brain\\b7d6f905-b265-4445-8009-1fc810b5df9c\\media__1783745361656.pdf');
  await readPdf('C:\\Users\\ASUS\\.gemini\\antigravity\\brain\\b7d6f905-b265-4445-8009-1fc810b5df9c\\media__1783745548441.pdf');
  await readPdf('C:\\Users\\ASUS\\.gemini\\antigravity\\brain\\b7d6f905-b265-4445-8009-1fc810b5df9c\\media__1783745192029.pdf');
}
run();
