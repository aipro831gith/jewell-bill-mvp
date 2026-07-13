const Tesseract = require('tesseract.js');
const fs = require('fs');

async function run() {
  console.log("Starting OCR on Template 2...");
  const imgPath = 'C:\\Users\\ASUS\\.gemini\\antigravity\\brain\\b7d6f905-b265-4445-8009-1fc810b5df9c\\media__1783749471919.jpg';
  
  Tesseract.recognize(
    imgPath,
    'eng',
    { logger: m => console.log(m) }
  ).then((result) => {
    const { data } = result;
    if (!data.lines) {
      console.log("Lines not found, searching in blocks");
      let allWords = [];
      (data.blocks || []).forEach(b => {
        (b.paragraphs || []).forEach(p => {
          (p.lines || []).forEach(l => {
            (l.words || []).forEach(w => allWords.push(w));
          });
        });
      });
      data.words = allWords;
    }
    const importantWords = (data.words || []).filter(w => 
      ['TAX', 'INVOICE', 'GSTIN', 'GSTIN:', 'PAN', 'STATE', 'BUYER', 'DETAILS', 'NAME:', 'CONTACT', 'CITY:', 'ADDRESS:', 'SR.', 'DESCRIPTION', 'HSN/SAC', 'WEIGHT', 'RATE', 'AMOUNT'].includes(w.text.toUpperCase())
    );
    
    importantWords.forEach(w => {
      console.log(`Word: ${w.text} | Box: x0=${w.bbox.x0}, y0=${w.bbox.y0}, x1=${w.bbox.x1}, y1=${w.bbox.y1}`);
    });
  });
}
run();
