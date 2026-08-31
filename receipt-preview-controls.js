/* CAREN_RECEIPT_PREVIEW_CONTROLS_V1 */
(function installReceiptPreviewControls(){
  if(typeof printReceipt!=='function')return;

  function receiptDay(iso){
    try{return new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(iso))}
    catch(_){return String(iso||'')}
  }

  printReceipt=function(a){
    if(!a||a.type!=='INCOME')return;
    const items=Array.isArray(a.items)?a.items:[];
    const itemRows=items.length?items.map(i=>{
      const label=esc((i.name||'Produit')+(i.format?' ('+i.format+')':''));
      const q=Number(i.qty)||0,up=Number(i.unitPrice)||0,total=Number(i.total)||q*up;
      return '<tr><td>'+label+'</td><td class="center-cell">'+q+'</td><td class="num">'+money(up)+'</td><td class="num strong">'+money(total)+'</td></tr>';
    }).join(''):'<tr><td colspan="4">'+esc(a.label||'Vente')+'</td></tr>';

    const discount=Number(a.discountAmount)||0;
    const number=receiptNumber(a);
    const verifyUrl=new URL('./verify.html?receipt='+encodeURIComponent(a.id),window.location.href).href;
    const paid=a.paidAmount==null?Number(a.amount)||0:Number(a.paidAmount)||0;
    const remaining=Number(a.remainingAmount)||0;
    const status=a.paymentStatus==='PARTIAL'?'Paiement partiel':a.paymentStatus==='UNPAID'?'Non payé':'Payé';

    const html='<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reçu '+number+'</title><style>'+ 
    '*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#111827;background:#eef1f5}body{padding:18px 10px 26px}.paper{width:min(390px,100%);margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:18px;box-shadow:0 16px 45px rgba(17,24,39,.10);overflow:hidden}.receipt{padding:22px 22px 18px}.brand{text-align:center;padding-bottom:14px}.brand-name{font-size:22px;font-weight:900;letter-spacing:2.2px}.brand-sub{margin-top:3px;font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:#6b7280}.rule{height:1px;background:#d1d5db;margin:0 0 14px}.meta{font-size:11px;line-height:1.55}.meta-row{display:flex;gap:10px}.meta-row b{min-width:92px}.meta-row span{flex:1;text-align:right}.financial{position:relative;overflow:hidden;margin-top:14px;padding-top:2px}.financial:before{content:"CARÈNE";position:absolute;left:50%;top:48%;transform:translate(-50%,-50%) rotate(-25deg);font-size:64px;font-weight:900;letter-spacing:8px;color:rgba(17,24,39,.045);white-space:nowrap;z-index:0;pointer-events:none}.financial>*{position:relative;z-index:1}table{width:100%;border-collapse:collapse;margin-top:5px}th{font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;padding:8px 3px;border-bottom:1px solid #d1d5db;text-align:left}td{font-size:10px;padding:9px 3px;border-bottom:1px solid #eef0f3;vertical-align:top}.center-cell{text-align:center}.num{text-align:right;white-space:nowrap}.strong{font-weight:800}.totals{padding-top:8px}.row{display:flex;justify-content:space-between;gap:14px;padding:4px 0;font-size:11px}.row span:first-child{color:#4b5563}.row strong{white-space:nowrap}.grand{margin-top:7px;padding:10px 0;border-top:2px solid #111827;border-bottom:1px solid #d1d5db;font-size:15px;font-weight:900}.grand span:first-child{color:#111827;letter-spacing:.3px}.payment-box{margin-top:9px;padding:9px 10px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px}.payment-box .row{padding:3px 0}.note{margin-top:10px;padding:9px 10px;border-left:3px solid #d1d5db;background:#fafafa;font-size:10px;line-height:1.45}.verify{margin-top:14px;padding-top:13px;border-top:1px dashed #d1d5db;text-align:center}.qr{width:96px;height:96px;margin:0 auto 7px}.verify-title{font-size:10px;font-weight:800}.verify-sub{font-size:8.5px;color:#6b7280;margin-top:2px}.receipt-no{display:inline-block;margin-top:6px;padding:4px 8px;border:1px solid #e5e7eb;border-radius:999px;font-size:8.5px;font-weight:700;letter-spacing:.3px}.thanks{text-align:center;color:#6b7280;font-size:10px;padding-top:13px}.no-print{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;padding:0 18px 18px}.btn{border:0;border-radius:10px;padding:10px 13px;font-size:11px;font-weight:800;cursor:pointer}.btn.back{background:#fff;color:#111827;border:1px solid #d1d5db}.btn.print{background:#111827;color:#fff}@media(max-width:420px){body{padding:10px 6px 18px}.receipt{padding:18px 17px 15px}.paper{border-radius:14px}.brand-name{font-size:20px}.financial:before{font-size:54px}}@media print{html,body{background:#fff!important}body{padding:0}.paper{width:100%;max-width:none;border:0;border-radius:0;box-shadow:none}.receipt{padding:0}.no-print{display:none!important}.financial:before{color:rgba(17,24,39,.05)!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{margin:8mm}}'+
    '</style></head><body><div class="paper"><div class="receipt"><div class="brand"><div class="brand-name">CARÈNE</div><div class="brand-sub">Reçu de vente</div></div><div class="rule"></div><div class="meta">'+
    '<div class="meta-row"><b>N° de reçu</b><span>'+esc(number)+'</span></div><div class="meta-row"><b>Jour de livraison</b><span>'+esc(receiptDay(a.date))+'</span></div>'+
    (a.customerName?'<div class="meta-row"><b>Client</b><span>'+esc(a.customerName)+'</span></div>':'')+
    (a.customerPhone?'<div class="meta-row"><b>Téléphone</b><span>'+esc(a.customerPhone)+'</span></div>':'')+
    '<div class="meta-row"><b>Paiement</b><span>'+esc(a.payment||'—')+'</span></div>'+
    (a.deliveryLocation?'<div class="meta-row"><b>Livraison</b><span>'+esc(a.deliveryLocation)+'</span></div>':'')+
    '<div class="meta-row"><b>Statut</b><span>'+esc(status)+'</span></div></div>'+
    '<div class="financial"><table><thead><tr><th>Produit</th><th style="text-align:center">Qté</th><th style="text-align:right">PU</th><th style="text-align:right">Total</th></tr></thead><tbody>'+itemRows+'</tbody></table><div class="totals">'+
    '<div class="row"><span>Sous-total produits</span><strong>'+money(Number(a.baseAmount)||Number(a.amount)||0)+'</strong></div>'+
    (discount?'<div class="row"><span>Réduction</span><strong>− '+money(discount)+'</strong></div>':'')+
    (Number(a.deliveryPrice)?'<div class="row"><span>Livraison</span><strong>'+money(a.deliveryPrice)+'</strong></div>':'')+
    '<div class="row grand"><span>MONTANT TOTAL</span><strong>'+money(a.amount)+'</strong></div></div><div class="payment-box">'+
    '<div class="row"><span>Montant payé / avance</span><strong>'+money(paid)+'</strong></div><div class="row"><span>Reste à payer</span><strong>'+money(remaining)+'</strong></div></div></div>'+
    (a.note?'<div class="note"><strong>Note :</strong> '+esc(a.note)+'</div>':'')+
    '<div class="verify"><div id="receiptQr" class="qr"></div><div class="verify-title">Vérification du reçu</div><div class="verify-sub">Scannez ce QR code pour vérifier ce reçu dans CARÈNE.</div><div class="receipt-no">'+esc(number)+'</div></div><div class="thanks">Merci pour votre achat.</div></div><div class="no-print"><button id="receiptBackBtn" class="btn back" type="button">← Retour à l’application</button><button class="btn print" type="button" onclick="window.print()">Imprimer / Enregistrer PDF</button></div></div><script>document.getElementById("receiptBackBtn").onclick=function(){if(window.opener&&!window.opener.closed){window.opener.focus();window.close()}else{history.back()}}<\/script></body></html>';

    const w=window.open('','_blank','width=430,height=760');
    if(!w){alert("Le navigateur a bloqué l'ouverture du reçu. Autorisez les fenêtres contextuelles.");return}
    w.document.open();w.document.write(html);w.document.close();w.focus();
    const qrBox=w.document.getElementById('receiptQr');
    const qrScript=w.document.createElement('script');
    qrScript.src='https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
    qrScript.onload=()=>{if(w.QRCode&&qrBox)new w.QRCode(qrBox,{text:verifyUrl,width:96,height:96,correctLevel:w.QRCode.CorrectLevel.M})};
    w.document.head.appendChild(qrScript);
  };
})();
