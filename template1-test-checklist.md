# Template 1 test checklist

- [ ] Open `invoice-template.html` through a local web server and confirm three pages are present.
- [ ] Confirm page labels are exactly: ORIGINAL FOR RECIPIENT, DUPLICATE FOR TRANSPORTER, TRIPLICATE FOR SUPPLIER.
- [ ] Confirm the title changes to DELIVERY CHALLAN only when `documentType` changes.
- [ ] Change `customer.idType` from `PAN` to `AADHAAR`; confirm only the buyer ID label changes.
- [ ] Set `purityColumn` to `false`; confirm the column disappears and adjacent columns reflow.
- [ ] Set `discountAmount` above zero; confirm subtotal and discount rows appear and the item area becomes shorter.
- [ ] Set `taxMode` to `LOCAL`; confirm CGST and SGST calculate at 1.5% and IGST is zero.
- [ ] Set `taxMode` to `INTERSTATE`; confirm IGST calculates at 3% and CGST/SGST are zero.
- [ ] Confirm delivery challans calculate zero GST.
- [ ] Confirm E&OE appears below the jurisdiction line on all three copies.
- [ ] Run `node render-pdf.js` and confirm the output contains three A4 pages.
