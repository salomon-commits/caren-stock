/* CAREN_ENHANCEMENTS_V2 */
(function installCarenEnhancements(){
  const accountingPage=$('page-accounting');
  if(accountingPage){
    const grid=accountingPage.querySelector('.grid4');
    if(grid&&!$('aOutstanding')){
      grid.insertAdjacentHTML('beforeend','<div class="stat"><small>Reste total clients</small><b id="aOutstanding">0 F</b></div>');
    }
    if(!$('outstandingList')&&grid){
      grid.insertAdjacentHTML('afterend','<div class="card"><div class="card-head"><h2>Restes à payer clients</h2></div><p class="section-sub">Les montants encore dus sont suivis séparément. Un versement met à jour la vente sans la recréer.</p><div id="outstandingList"></div></div>');
    }
    const lastHead=accountingPage.querySelector('thead tr th:last-child');
    if(lastHead)lastHead.textContent='Actions';
  }

  function setSalePaymentState(a,status,paid){
    const total=Math.max(0,Number(a.amount)||0);
    let cleanStatus=['PAID','PARTIAL','UNPAID'].includes(status)?status:'PAID';
    let cleanPaid=Math.max(0,Math.min(total,Number(paid)||0));
    if(cleanStatus==='PAID')cleanPaid=total;
    if(cleanStatus==='UNPAID')cleanPaid=0;
    if(cleanPaid<=0&&cleanStatus==='PARTIAL')cleanStatus='UNPAID';
    if(cleanPaid>=total&&total>0)cleanStatus='PAID';
    a.paymentStatus=cleanStatus;
    a.paidAmount=cleanStatus==='PAID'?total:cleanStatus==='UNPAID'?0:cleanPaid;
    a.remainingAmount=Math.max(0,total-a.paidAmount);
  }

  function getPreservedGlobalDiscount(a){
    const items=Array.isArray(a.items)?a.items:[];
    const itemDiscount=items.reduce((s,i)=>s+(Number(i.discountAmount)||0),0);
    if(Number.isFinite(Number(a.globalDiscountAmount)))return Math.max(0,Number(a.globalDiscountAmount));
    return Math.max(0,(Number(a.discountAmount)||0)-itemDiscount);
  }

  function recalcSaleTotals(a,globalFixed){
    const items=Array.isArray(a.items)?a.items:[];
    a.baseAmount=items.reduce((s,i)=>s+(Number(i.unitPrice)||0)*(Number(i.qty)||0),0);
    const itemDiscount=items.reduce((s,i)=>s+(Number(i.discountAmount)||0),0);
    const afterItems=Math.max(0,a.baseAmount-itemDiscount);
    const globalDiscount=Math.min(afterItems,Math.max(0,Number(globalFixed)||0));
    a.globalDiscountType=globalDiscount>0?'AMOUNT':'NONE';
    a.globalDiscountValue=globalDiscount;
    a.globalDiscountAmount=globalDiscount;
    a.discountAmount=itemDiscount+globalDiscount;
    a.productAmount=Math.max(0,afterItems-globalDiscount);
    a.amount=a.productAmount+(Number(a.deliveryPrice)||0);
    setSalePaymentState(a,a.paymentStatus,Math.min(Number(a.paidAmount)||0,a.amount));
  }

  recalcLinkedSale=function(draft,movement,newQty){
    const a=draft.accounts.find(x=>x.type==='INCOME'&&(x.movementId===movement.id||(Array.isArray(x.movementIds)&&x.movementIds.includes(movement.id))));
    if(!a||!Array.isArray(a.items))return;
    const preservedGlobal=getPreservedGlobalDiscount(a);
    let itemIndex=-1;
    if(Array.isArray(a.movementIds)){
      const pos=a.movementIds.indexOf(movement.id);
      if(pos>=0&&a.items[pos])itemIndex=pos;
    }
    if(itemIndex<0)itemIndex=a.items.findIndex(i=>i.productId===movement.productId);
    if(itemIndex<0)return;
    const item=a.items[itemIndex];
    item.qty=newQty;
    const base=(Number(item.unitPrice)||0)*newQty;
    item.discountAmount=discountAmount(base,item.discountType,item.discountValue);
    item.total=Math.max(0,base-item.discountAmount);
    recalcSaleTotals(a,preservedGlobal);
  };

  updateAccountingAfterMovementDelete=function(draft,movement){
    for(let aIndex=draft.accounts.length-1;aIndex>=0;aIndex--){
      const a=draft.accounts[aIndex];
      if(a.movementId===movement.id){draft.accounts.splice(aIndex,1);continue}
      if(Array.isArray(a.movementIds)&&a.movementIds.includes(movement.id)){
        const preservedGlobal=getPreservedGlobalDiscount(a);
        const pos=a.movementIds.indexOf(movement.id);
        a.movementIds=a.movementIds.filter(id=>id!==movement.id);
        if(Array.isArray(a.items)){
          if(pos>=0&&a.items[pos])a.items.splice(pos,1);
          else{
            const idx=a.items.findIndex(i=>i.productId===movement.productId);
            if(idx>=0)a.items.splice(idx,1);
          }
        }
        if(!Array.isArray(a.items)||a.items.length===0){draft.accounts.splice(aIndex,1);continue}
        a.label='Vente de '+a.items.length+' produit'+(a.items.length>1?'s':'');
        recalcSaleTotals(a,preservedGlobal);
      }
    }
  };

  function collectPayment(id){
    const a=(data.accounts||[]).find(x=>x.type==='INCOME'&&x.id===id);if(!a)return;
    const remaining=Math.max(0,Number(a.remainingAmount)||0);
    if(remaining<=0){alert('Cette vente est déjà entièrement payée.');return}
    const raw=prompt('Montant du nouveau versement :',String(remaining));if(raw===null)return;
    const amount=Number(raw);
    if(!Number.isFinite(amount)||amount<=0||amount>remaining){alert('Montant invalide. Maximum : '+money(remaining));return}
    const method=prompt('Moyen de paiement :',a.payment||'Espèces');if(method===null)return;
    const draft=cloneData(),da=draft.accounts.find(x=>x.id===id);if(!da)return;
    const total=Number(da.amount)||0;
    const nextPaid=Math.min(total,(Number(da.paidAmount)||0)+amount);
    setSalePaymentState(da,nextPaid>=total?'PAID':'PARTIAL',nextPaid);
    if(method.trim())da.payment=method.trim();
    const stamp=new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',timeStyle:'short'}).format(new Date());
    const line='Versement '+money(amount)+' le '+stamp+(method.trim()?' via '+method.trim():'');
    da.note=[da.note,line].filter(Boolean).join(' | ');
    if(save(draft))alert(da.remainingAmount===0?'Paiement soldé.':'Versement enregistré. Reste : '+money(da.remainingAmount));
  }

  function editSale(id){
    const draft=cloneData(),a=draft.accounts.find(x=>x.type==='INCOME'&&x.id===id);if(!a)return;
    const customer=prompt('Nom du client :',a.customerName||'');if(customer===null)return;
    const phone=prompt('Téléphone :',a.customerPhone||'');if(phone===null)return;
    const deliveryLocation=prompt('Lieu de livraison :',a.deliveryLocation||'');if(deliveryLocation===null)return;
    const deliveryRaw=prompt('Prix de livraison :',String(Number(a.deliveryPrice)||0));if(deliveryRaw===null)return;
    const delivery=Number(deliveryRaw);if(!Number.isFinite(delivery)||delivery<0){alert('Prix de livraison invalide.');return}
    const dateRaw=prompt('Jour de livraison (AAAA-MM-JJ) :',localDateValue(new Date(a.date)));if(dateRaw===null)return;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)||Number.isNaN(new Date(dateRaw+'T12:00:00').getTime())){alert('Date invalide.');return}
    const payment=prompt('Moyen de paiement (Espèces, Mobile Money, Virement, Carte, Crédit) :',a.payment||'Espèces');if(payment===null)return;
    const note=prompt('Note :',a.note||'');if(note===null)return;

    const items=Array.isArray(a.items)?a.items:[];
    const movementIds=Array.isArray(a.movementIds)?a.movementIds:[];
    const previousGlobal=getPreservedGlobalDiscount(a);
    for(let index=0;index<items.length;index++){
      const item=items[index];
      const oldQty=positiveInt(item.qty)||1;
      const movementId=movementIds[index];
      if(movementId){
        const qtyRaw=prompt('Quantité — '+(item.name||'Produit')+' :',String(oldQty));if(qtyRaw===null)return;
        const newQty=positiveInt(qtyRaw);if(newQty===null){alert('Quantité invalide.');return}
        const diff=newQty-oldQty;
        const p=draft.products.find(x=>x.id===item.productId);
        const m=draft.movements.find(x=>x.id===movementId);
        if(!p||!m){alert('Mouvement de stock lié introuvable. Modification annulée.');return}
        if(diff>0&&Number(p.stock)<diff){alert('Stock insuffisant pour augmenter '+(item.name||'ce produit')+'. Disponible : '+p.stock);return}
        p.stock-=diff;
        m.qty=newQty;
        m.date=deliveryDateISO(dateRaw);
        item.qty=newQty;
        recomputeProductSnapshots(draft,item.productId);
      }
      const typeRaw=prompt('Réduction '+(item.name||'produit')+' : NONE, PERCENT ou AMOUNT',item.discountType||'NONE');if(typeRaw===null)return;
      const type=String(typeRaw).trim().toUpperCase();
      if(!['NONE','PERCENT','AMOUNT'].includes(type)){alert('Type de réduction invalide.');return}
      let value=0;
      if(type!=='NONE'){
        const valueRaw=prompt(type==='PERCENT'?'Pourcentage de réduction :':'Montant de réduction :',String(Number(item.discountValue)||0));if(valueRaw===null)return;
        value=Math.max(0,Number(valueRaw)||0);
      }
      item.discountType=type;item.discountValue=value;
      const base=(Number(item.unitPrice)||0)*(Number(item.qty)||0);
      item.discountAmount=discountAmount(base,type,value);
      item.total=Math.max(0,base-item.discountAmount);
    }
    const globalRaw=prompt('Réduction globale en montant (F) :',String(previousGlobal));if(globalRaw===null)return;
    const globalFixed=Math.max(0,Number(globalRaw)||0);

    a.customerName=customer.trim();a.customerPhone=phone.trim();a.deliveryLocation=deliveryLocation.trim();a.deliveryPrice=delivery;
    a.date=deliveryDateISO(dateRaw);a.payment=payment.trim()||a.payment;a.note=note.trim();
    recalcSaleTotals(a,globalFixed);

    const statusRaw=prompt('Statut : PAID, PARTIAL ou UNPAID',a.paymentStatus||'PAID');if(statusRaw===null)return;
    let status=String(statusRaw).trim().toUpperCase();
    if(!['PAID','PARTIAL','UNPAID'].includes(status)){alert('Statut invalide.');return}
    let paid=0;
    if(status==='PAID')paid=a.amount;
    else if(status==='PARTIAL'){
      const paidRaw=prompt('Montant déjà payé / avance :',String(Math.min(Number(a.paidAmount)||0,a.amount)));if(paidRaw===null)return;
      paid=Number(paidRaw);if(!Number.isFinite(paid)||paid<0||paid>a.amount){alert('Montant payé invalide.');return}
    }
    setSalePaymentState(a,status,paid);

    if(!confirm('Enregistrer toutes les modifications de cette vente ?'))return;
    if(save(draft))alert('Vente modifiée et calculs recalculés.');
  }

  renderAccounting=function(){
    const q=String($('accountingSearch')?.value||'').trim().toLowerCase();
    const allAccounts=Array.isArray(data.accounts)?data.accounts:[];
    const accounts=allAccounts.filter(a=>!q||((a.label||'')+' '+(a.note||'')+' '+(a.payment||'')+' '+(a.customerName||'')+' '+(a.customerPhone||'')+' '+(a.deliveryLocation||'')+' '+(a.paymentStatus||'')).toLowerCase().includes(q));
    const today=dayKey(),month=monthKey();
    const todaySales=allAccounts.filter(a=>a.type==='INCOME'&&dayKey(new Date(a.date))===today).reduce((s,a)=>s+saleProductAmount(a),0);
    const monthIncome=allAccounts.filter(a=>a.type==='INCOME'&&monthKey(new Date(a.date))===month);
    const monthSales=monthIncome.reduce((s,a)=>s+saleProductAmount(a),0);
    const monthDelivery=monthIncome.reduce((s,a)=>s+(Number(a.deliveryPrice)||0),0);
    const monthExpenses=allAccounts.filter(a=>a.type==='EXPENSE'&&monthKey(new Date(a.date))===month).reduce((s,a)=>s+Number(a.amount||0),0);
    const outstandingSales=allAccounts.filter(a=>a.type==='INCOME'&&Number(a.remainingAmount)>0).sort((a,b)=>new Date(b.date)-new Date(a.date));
    const outstandingTotal=outstandingSales.reduce((s,a)=>s+(Number(a.remainingAmount)||0),0);
    $('aToday').textContent=money(todaySales);$('aMonthSales').textContent=money(monthSales);$('aMonthDelivery').textContent=money(monthDelivery);$('aMonthExpenses').textContent=money(monthExpenses);$('aMonthProfit').textContent=money(monthSales-monthExpenses);
    if($('aOutstanding'))$('aOutstanding').textContent=money(outstandingTotal);
    if($('outstandingList'))$('outstandingList').innerHTML=outstandingSales.length?outstandingSales.slice(0,30).map(a=>`<div class="product-card"><div class="meta"><strong>${esc(a.customerName||'Client non renseigné')}</strong><small>${esc(a.customerPhone||'')}${a.customerPhone?' • ':''}${dt(a.date)} • Total ${money(a.amount)}</small></div><div class="product-stock"><b>${money(a.remainingAmount)}</b><button class="btn success small" data-collect-payment="${a.id}">Encaisser</button></div></div>`).join(''):'<div class="notice success">Aucun reste à payer.</div>';
    $('accountingBody').innerHTML=accounts.length?accounts.slice(0,100).map(a=>`<tr><td>${dt(a.date)}</td><td>${a.type==='INCOME'?'<span class="badge ok">Vente</span>':'<span class="badge zero">Dépense</span>'}</td><td><strong>${esc(a.label||'—')}</strong>${a.customerName?'<br><small style="color:var(--muted)">Client : '+esc(a.customerName)+'</small>':''}${a.deliveryLocation?'<br><small style="color:var(--muted)">Livraison : '+esc(a.deliveryLocation)+'</small>':''}${a.paymentStatus?'<br><small style="color:var(--muted)">Statut : '+esc(a.paymentStatus==='PAID'?'Payé':a.paymentStatus==='PARTIAL'?'Partiel':'Non payé')+(Number(a.remainingAmount)>0?' • Reste '+money(a.remainingAmount):'')+'</small>':''}${a.note?'<br><small style="color:var(--muted)">'+esc(a.note)+'</small>':''}</td><td>${esc(a.payment||'—')}</td><td class="${a.type==='INCOME'?'positive':'negative'}"><strong>${a.type==='INCOME'?'+':'−'}${money(a.type==='INCOME'?saleProductAmount(a):a.amount)}</strong>${a.type==='INCOME'&&Number(a.deliveryPrice)>0?'<br><small style="color:var(--muted)">Livraison : '+money(a.deliveryPrice)+' • Total client : '+money(a.amount)+'</small>':''}</td><td>${a.type==='INCOME'?'<div class="actions"><button class="btn secondary small" data-edit-sale="'+a.id+'">Modifier</button>'+(Number(a.remainingAmount)>0?'<button class="btn success small" data-collect-payment="'+a.id+'">Encaisser</button>':'')+'<button class="btn secondary small" data-receipt="'+a.id+'">Imprimer</button></div>':'—'}</td></tr>`).join(''):'<tr><td colspan="6" class="empty">Aucune opération comptable.</td></tr>';
    document.querySelectorAll('[data-edit-sale]').forEach(b=>b.onclick=()=>editSale(b.dataset.editSale));
    document.querySelectorAll('[data-collect-payment]').forEach(b=>b.onclick=()=>collectPayment(b.dataset.collectPayment));
    document.querySelectorAll('[data-receipt]').forEach(b=>b.onclick=()=>{const a=(data.accounts||[]).find(x=>x.id===b.dataset.receipt);if(a)printReceipt(a)});
  };
  if($('accountingSearch'))$('accountingSearch').oninput=renderAccounting;

  printReceipt=function(a){
    if(!a||a.type!=='INCOME')return;
    const items=Array.isArray(a.items)?a.items:[];
    let itemRows='';
    if(items.length){itemRows=items.map(i=>{const label=esc((i.name||'Produit')+(i.format?' ('+i.format+')':''));const q=Number(i.qty)||0,up=Number(i.unitPrice)||0,total=Number(i.total)||q*up;return '<tr><td>'+label+'</td><td style="text-align:center">'+q+'</td><td style="text-align:right">'+money(up)+'</td><td style="text-align:right">'+money(total)+'</td></tr>'}).join('')}
    else itemRows='<tr><td colspan="4">'+esc(a.label||'Vente')+'</td></tr>';
    const discount=Number(a.discountAmount)||0;
    const verifyUrl=new URL('./verify.html?receipt='+encodeURIComponent(a.id),window.location.href).href;
    const html='<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Reçu '+receiptNumber(a)+'</title><style>body{font-family:Arial,sans-serif;margin:0;padding:18px;color:#111;font-size:13px;background:#fff}.receipt{max-width:380px;margin:auto;position:relative;isolation:isolate}.receipt:before{content:"CARÈNE";position:fixed;left:50%;top:48%;transform:translate(-50%,-50%) rotate(-28deg);font-size:78px;font-weight:900;letter-spacing:8px;color:rgba(17,24,39,.055);white-space:nowrap;z-index:-1;pointer-events:none}.receipt:after{content:"CARÈNE  •  CARÈNE  •  CARÈNE";position:fixed;left:50%;top:72%;transform:translateX(-50%) rotate(-28deg);font-size:18px;font-weight:800;letter-spacing:5px;color:rgba(17,24,39,.04);white-space:nowrap;z-index:-1;pointer-events:none}.center{text-align:center}.muted{color:#666}.line{border-top:1px dashed #999;margin:12px 0}h1{font-size:20px;margin:0 0 4px}table{width:100%;border-collapse:collapse}th,td{padding:7px 3px;border-bottom:1px solid #eee;font-size:12px}th{text-align:left}.row{display:flex;justify-content:space-between;padding:4px 0}.total{font-size:17px;font-weight:700;border-top:2px solid #111;padding-top:8px;margin-top:5px}.no-print{margin-top:18px;text-align:center}.btn{padding:10px 16px;border:0;background:#111;color:#fff;border-radius:8px;font-weight:700}@media print{body{padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none}.receipt:before,.receipt:after{position:fixed}@page{margin:8mm}}</style></head><body><div class="receipt"><div class="center"><h1>CARÈNE</h1><div class="muted">Reçu de vente</div></div><div class="line"></div><div><strong>N° :</strong> '+receiptNumber(a)+'</div><div><strong>Date :</strong> '+dt(a.date)+'</div>'+(a.customerName?'<div><strong>Client :</strong> '+esc(a.customerName)+'</div>':'')+(a.customerPhone?'<div><strong>Téléphone :</strong> '+esc(a.customerPhone)+'</div>':'')+'<div><strong>Paiement :</strong> '+esc(a.payment||'—')+'</div>'+(a.deliveryLocation?'<div><strong>Lieu de livraison :</strong> '+esc(a.deliveryLocation)+'</div>':'')+'<div><strong>Statut :</strong> '+esc(a.paymentStatus==='PAID'?'Payé':a.paymentStatus==='PARTIAL'?'Paiement partiel':a.paymentStatus==='UNPAID'?'Non payé':'Payé')+'</div><div class="line"></div><table><thead><tr><th>Produit</th><th style="text-align:center">Qté</th><th style="text-align:right">PU</th><th style="text-align:right">Total</th></tr></thead><tbody>'+itemRows+'</tbody></table><div class="row"><span>Sous-total produits</span><strong>'+money(Number(a.baseAmount)||Number(a.amount)||0)+'</strong></div>'+(discount?'<div class="row"><span>Réduction</span><strong>− '+money(discount)+'</strong></div>':'')+(Number(a.deliveryPrice)?'<div class="row"><span>Livraison</span><strong>'+money(a.deliveryPrice)+'</strong></div>':'')+'<div class="row total"><span>MONTANT TOTAL</span><span>'+money(a.amount)+'</span></div><div class="row"><span>Montant payé / avance</span><strong>'+money(a.paidAmount==null?a.amount:a.paidAmount)+'</strong></div><div class="row"><span>Reste à payer</span><strong>'+money(a.remainingAmount||0)+'</strong></div>'+(a.note?'<div class="line"></div><div><strong>Note :</strong> '+esc(a.note)+'</div>':'')+'<div class="line"></div><div class="center"><div id="receiptQr" style="width:112px;height:112px;margin:10px auto"></div><div class="muted" style="font-size:10px">Scannez pour vérifier ce reçu dans CARÈNE</div><div class="muted" style="font-size:9px;margin-top:4px">'+esc(receiptNumber(a))+'</div></div><div class="line"></div><div class="center muted">Merci pour votre achat.</div><div class="no-print"><button class="btn" onclick="window.print()">Imprimer / Enregistrer PDF</button></div></div></body></html>';
    const w=window.open('','_blank','width=420,height=760');if(!w){alert("Le navigateur a bloqué l'ouverture du reçu. Autorisez les fenêtres contextuelles.");return}
    w.document.open();w.document.write(html);w.document.close();w.focus();
    const qrBox=w.document.getElementById('receiptQr');const qrScript=w.document.createElement('script');qrScript.src='https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';qrScript.onload=()=>{if(w.QRCode&&qrBox)new w.QRCode(qrBox,{text:verifyUrl,width:112,height:112,correctLevel:w.QRCode.CorrectLevel.M})};w.document.head.appendChild(qrScript);
  };

  let receiptVerificationShown=false;
  function checkReceiptVerification(){
    const id=new URLSearchParams(window.location.search).get('receipt');if(!id||receiptVerificationShown)return;
    const a=(data.accounts||[]).find(x=>x.type==='INCOME'&&x.id===id);
    if(!a&&!cloudReady)return;
    receiptVerificationShown=true;
    const overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;background:rgba(17,24,39,.72);z-index:9999;display:grid;place-items:center;padding:18px';
    const box=document.createElement('div');box.style.cssText='width:min(430px,100%);background:#fff;border-radius:20px;padding:22px;box-shadow:0 24px 80px rgba(0,0,0,.28)';
    if(a){box.innerHTML='<div style="font-size:34px">✓</div><h2 style="margin:6px 0">Reçu CARÈNE vérifié</h2><div class="notice success">Ce numéro correspond à une vente actuellement enregistrée dans CARÈNE.</div><div class="summary" style="margin-top:14px">'+summaryRows([['N°',receiptNumber(a)],['Date',dt(a.date)],['Client',a.customerName||'—'],['Montant total',money(a.amount)],['Payé',money(a.paidAmount==null?a.amount:a.paidAmount)],['Reste',money(a.remainingAmount||0)]])+'</div>'}
    else box.innerHTML='<div style="font-size:34px">!</div><h2 style="margin:6px 0">Reçu introuvable</h2><div class="notice warning">Ce numéro de reçu n’existe pas dans les données CARÈNE actuellement synchronisées.</div>';
    const close=document.createElement('button');close.className='btn';close.style.marginTop='16px';close.textContent='Fermer';close.onclick=()=>{overlay.remove();history.replaceState({},'',window.location.pathname)};box.appendChild(close);overlay.appendChild(box);document.body.appendChild(overlay);
  }

  const originalPullCloudData=pullCloudData;
  pullCloudData=async function(){const result=await originalPullCloudData.apply(this,arguments);checkReceiptVerification();return result};
  setTimeout(checkReceiptVerification,0);

  /* CAREN_MOBILE_UX_V3 */
  const mobileUxStyle=document.createElement('style');
  mobileUxStyle.textContent=`
    .btn:disabled{opacity:.42;cursor:not-allowed;box-shadow:none!important;transform:none!important}
    @media(max-width:560px){
      .topbar{height:74px;padding:0 12px;gap:8px;position:sticky}
      .topbar>div:first-child{min-width:0;flex:1}
      .topbar h1{font-size:18px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-bottom:15px}
      .topbar>div:last-child{flex:0 0 auto;gap:5px!important}
      .topbar .sync-status{position:absolute;left:13px;bottom:7px;font-size:9px;line-height:1;color:#6b7280}
      .topbar .btn.small{padding:8px 10px;font-size:11px;white-space:nowrap;border-radius:10px}
      .topbar #installAppBtn:not([hidden]){display:none}
      .content{padding-top:14px}
      .section-title{font-size:20px}
      #page-entry .picker-list,#page-exit .picker-list{padding-bottom:92px}
      #page-entry [data-entry-panel="1"] .wizard-actions,
      #page-exit [data-exit-panel="1"] .wizard-actions{
        position:sticky;bottom:84px;z-index:6;
        padding:12px 0 4px;
        background:linear-gradient(to bottom,rgba(255,255,255,0),#fff 28%);
      }
      #page-entry [data-entry-panel="1"] .wizard-actions .btn,
      #page-exit [data-exit-panel="1"] .wizard-actions .btn{min-width:150px}
    }
    @media(max-width:700px){
      #page-history .table-wrap,#page-accounting .table-wrap,#page-products .table-wrap{border:0;overflow:visible}
      #page-history table,#page-accounting table,#page-products table{display:block;min-width:0;width:100%}
      #page-history thead,#page-accounting thead,#page-products thead{display:none}
      #page-history tbody,#page-accounting tbody,#page-products tbody{display:grid;gap:10px}
      #page-history tr,#page-accounting tr,#page-products tr{display:block;background:#fff;border:1px solid var(--line);border-radius:14px;padding:10px 12px;box-shadow:0 6px 18px rgba(17,24,39,.04)}
      #page-history td,#page-accounting td,#page-products td{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:7px 0;border-bottom:1px dashed #e5e7eb;font-size:12px;text-align:right}
      #page-history td:last-child,#page-accounting td:last-child,#page-products td:last-child{border-bottom:0;padding-bottom:0}
      #page-history td::before,#page-accounting td::before,#page-products td::before{font-size:10px;font-weight:800;color:#6b7280;text-align:left;flex:0 0 88px}
      #page-history td:nth-child(1)::before{content:"Date"}
      #page-history td:nth-child(2)::before{content:"Produit"}
      #page-history td:nth-child(3)::before{content:"Type"}
      #page-history td:nth-child(4)::before{content:"Quantité"}
      #page-history td:nth-child(5)::before{content:"Stock après"}
      #page-history td:nth-child(6)::before{content:"Détail"}
      #page-history td:nth-child(7)::before{content:"Actions"}
      #page-accounting td:nth-child(1)::before{content:"Date"}
      #page-accounting td:nth-child(2)::before{content:"Type"}
      #page-accounting td:nth-child(3)::before{content:"Détail"}
      #page-accounting td:nth-child(4)::before{content:"Paiement"}
      #page-accounting td:nth-child(5)::before{content:"Montant"}
      #page-accounting td:nth-child(6)::before{content:"Actions"}
      #page-products td:nth-child(1)::before{content:"Produit"}
      #page-products td:nth-child(2)::before{content:"Catégorie"}
      #page-products td:nth-child(3)::before{content:"Format"}
      #page-products td:nth-child(4)::before{content:"Prix"}
      #page-products td:nth-child(5)::before{content:"Stock"}
      #page-products td:nth-child(6)::before{content:"État"}
      #page-products td:nth-child(7)::before{content:"Actions"}
      #page-history .actions,#page-accounting .actions,#page-products .actions{justify-content:flex-end}
      #page-history td.empty,#page-accounting td.empty,#page-products td.empty{display:block;text-align:center}
      #page-history td.empty::before,#page-accounting td.empty::before,#page-products td.empty::before{display:none}
      #page-history .toolbar,#page-accounting .toolbar,#page-products .toolbar{align-items:stretch}
      #page-history .toolbar>div,#page-history .toolbar .search,#page-accounting .toolbar .search,#page-products .toolbar .search{width:100%;max-width:none}
    }
  `;
  document.head.appendChild(mobileUxStyle);

  const dashboardGrid=$('page-dashboard')?.querySelector('.grid4');
  if(dashboardGrid&&!$('dZero')){
    const lowCard=$('dLow')?.closest('.stat');
    if(lowCard)lowCard.insertAdjacentHTML('afterend','<div class="stat"><small>Ruptures</small><b id="dZero">0</b></div>');
  }
  const previousRenderDashboard=renderDashboard;
  renderDashboard=function(){
    previousRenderDashboard();
    const zero=data.products.filter(p=>Number(p.stock)===0).length;
    const low=data.products.filter(p=>Number(p.stock)>0&&Number(p.stock)<=Number(p.threshold)).length;
    if($('dZero'))$('dZero').textContent=zero;
    if($('dLow'))$('dLow').textContent=low;
  };

  function refreshWizardAvailability(){
    const entryNext=document.querySelector('#page-entry [data-entry-panel="1"] [data-enext]');
    if(entryNext){
      entryNext.disabled=entryCart.length===0;
      entryNext.setAttribute('aria-disabled',entryNext.disabled?'true':'false');
    }
    const exitNext=document.querySelector('#page-exit [data-exit-panel="1"] [data-xnext]');
    if(exitNext){
      exitNext.disabled=exitCart.length===0;
      exitNext.setAttribute('aria-disabled',exitNext.disabled?'true':'false');
    }
  }

  const previousRenderEntryPicker=renderEntryPicker;
  renderEntryPicker=function(){
    previousRenderEntryPicker();
    refreshWizardAvailability();
  };

  const previousRenderExitPicker=renderExitPicker;
  renderExitPicker=function(){
    previousRenderExitPicker();
    document.querySelectorAll('[data-exit-add]').forEach(button=>{
      const product=productById(button.dataset.exitAdd);
      const selected=exitCart.some(i=>i.productId===button.dataset.exitAdd);
      if(product&&Number(product.stock)<=0&&!selected){
        button.disabled=true;
        button.textContent='Rupture';
        button.classList.add('secondary');
        button.setAttribute('aria-label',(product.name||'Produit')+' en rupture');
      }
    });
    refreshWizardAvailability();
  };


  refreshWizardAvailability();


  /* CAREN_EXIT_BY_PRODUCT_V1 */
  const historyPage=$('page-history');
  if(historyPage&&!$('exitByProductList')){
    const firstCard=historyPage.querySelector('.card');
    if(firstCard){
      firstCard.insertAdjacentHTML('beforebegin',
        '<div class="card" id="exitByProductCard">'+
          '<div class="card-head"><h2>Sorties par produit</h2><span class="badge ok" id="exitByProductTotal">0 unité</span></div>'+
          '<p class="section-sub">Total des unités sorties pour chaque produit.</p>'+
          '<div id="exitByProductList"></div>'+
        '</div>'
      );
    }
  }

  function renderExitByProduct(){
    if(!$('exitByProductList'))return;
    const totals=new Map();
    for(const m of (data.movements||[])){
      if(m.type!=='OUT')continue;
      const id=m.productId||m.productName;
      if(!totals.has(id))totals.set(id,{name:m.productName||productById(m.productId)?.name||'Produit',qty:0});
      totals.get(id).qty+=Number(m.qty)||0;
    }
    const rows=[...totals.values()].sort((a,b)=>b.qty-a.qty);
    const grand=rows.reduce((s,x)=>s+x.qty,0);
    if($('exitByProductTotal'))$('exitByProductTotal').textContent=grand+' unité'+(grand>1?'s':'');
    $('exitByProductList').innerHTML=rows.length?rows.map(x=>
      '<div class="product-card"><div class="meta"><strong>'+esc(x.name)+'</strong><small>Quantité totale sortie</small></div><div class="product-stock"><b>'+x.qty+'</b><span class="badge zero">sortie'+(x.qty>1?'s':'')+'</span></div></div>'
    ).join(''):'<div class="notice">Aucune sortie enregistrée.</div>';
  }

  const previousRenderHistoryExitTotals=renderHistory;
  renderHistory=function(){
    previousRenderHistoryExitTotals();
    renderExitByProduct();
  };
  renderExitByProduct();



  /* CAREN_DUPLICATE_EXIT_V1 */
  function aggregateSaleItems(a){
    const map=new Map();
    for(const i of (Array.isArray(a.items)?a.items:[])){
      const key=String(i.productId||i.name||'').trim();
      if(!key)continue;
      const row=map.get(key)||{name:i.name||productById(i.productId)?.name||'Produit',qty:0};
      row.qty+=Number(i.qty)||0;
      map.set(key,row);
    }
    return [...map.entries()].map(([key,v])=>({key,name:v.name,qty:v.qty})).sort((a,b)=>a.key.localeCompare(b.key));
  }

  function saleDuplicateSignature(a){
    const day=localDateValue(new Date(a.date));
    const customer=(a.customerPhone||a.customerName||'').trim().toLowerCase();
    const items=aggregateSaleItems(a).map(x=>x.key+':'+x.qty).join('|');
    const total=Number(a.amount)||0;
    const delivery=Number(a.deliveryPrice)||0;
    return [day,customer,items,total,delivery].join('||');
  }

  function findDuplicateSaleGroups(){
    const groups=new Map();
    for(const a of (data.accounts||[])){
      if(a.type!=='INCOME')continue;
      const sig=saleDuplicateSignature(a);
      if(!groups.has(sig))groups.set(sig,[]);
      groups.get(sig).push(a);
    }
    return [...groups.values()].filter(g=>g.length>1).sort((a,b)=>new Date(b[0].date)-new Date(a[0].date));
  }

  const historyPageDup=$('page-history');
  if(historyPageDup&&!$('duplicateExitList')){
    const ref=$('exitByProductCard')||historyPageDup.querySelector('.card');
    if(ref){
      ref.insertAdjacentHTML('afterend',
        '<div class="card" id="duplicateExitCard">'+
          '<div class="card-head"><h2>Doublons possibles de sortie</h2><span class="badge low" id="duplicateExitCount">0</span></div>'+
          '<p class="section-sub">Même jour, même client, mêmes produits et quantités, même total. Vérifiez avant de supprimer.</p>'+
          '<div id="duplicateExitList"></div>'+
        '</div>'
      );
    }
  }

  function renderDuplicateExits(){
    if(!$('duplicateExitList'))return;
    const groups=findDuplicateSaleGroups();
    if($('duplicateExitCount'))$('duplicateExitCount').textContent=groups.length+' groupe'+(groups.length>1?'s':'');
    $('duplicateExitList').innerHTML=groups.length?groups.map(group=>{
      const a=group[0];
      const itemText=aggregateSaleItems(a).map(x=>x.name+' × '+x.qty).join(', ');
      return '<div class="product-card" style="align-items:flex-start"><div class="meta"><strong>'+esc(a.customerName||a.customerPhone||'Client non renseigné')+'</strong><small>'+esc(localDateValue(new Date(a.date)))+' • '+esc(itemText)+' • '+money(a.amount)+'</small><small style="margin-top:4px">Enregistré '+group.length+' fois</small></div><div class="product-stock"><span class="badge low">À vérifier</span></div></div>';
    }).join(''):'<div class="notice success">Aucun doublon évident détecté.</div>';
  }

  const previousRenderExitByProductV2=renderExitByProduct;
  renderExitByProduct=function(){
    if(!$('exitByProductList'))return;
    const totals=new Map();
    for(const m of (data.movements||[])){
      if(m.type!=='OUT')continue;
      const id=m.productId||m.productName;
      const row=totals.get(id)||{name:m.productName||productById(m.productId)?.name||'Produit',qty:0,operations:0};
      row.qty+=Number(m.qty)||0;
      row.operations+=1;
      totals.set(id,row);
    }
    const rows=[...totals.values()].sort((a,b)=>b.qty-a.qty);
    const grand=rows.reduce((s,x)=>s+x.qty,0);
    if($('exitByProductTotal'))$('exitByProductTotal').textContent=grand+' unité'+(grand>1?'s':'');
    $('exitByProductList').innerHTML=rows.length?rows.map(x=>
      '<div class="product-card"><div class="meta"><strong>'+esc(x.name)+'</strong><small>'+x.operations+' mouvement'+(x.operations>1?'s':'')+' de sortie</small></div><div class="product-stock"><b>'+x.qty+'</b><span class="badge zero">unité'+(x.qty>1?'s':'')+'</span></div></div>'
    ).join(''):'<div class="notice">Aucune sortie enregistrée.</div>';
    renderDuplicateExits();
  };

  function duplicateCandidateForCurrentExit(){
    if(!isSaleReason())return null;
    const fake={
      type:'INCOME',
      date:deliveryDateISO($('exitSaleDate').value),
      customerName:$('exitCustomerName').value.trim(),
      customerPhone:$('exitCustomerPhone').value.trim(),
      deliveryPrice:Math.max(0,Number($('exitDeliveryPrice').value)||0),
      amount:exitTotals().total+Math.max(0,Number($('exitDeliveryPrice').value)||0),
      items:exitCart.map(i=>{const p=productById(i.productId);return {productId:i.productId,name:p?.name||'',qty:positiveInt(i.qty)||0}})
    };
    const sig=saleDuplicateSignature(fake);
    return (data.accounts||[]).find(a=>a.type==='INCOME'&&saleDuplicateSignature(a)===sig)||null;
  }

  const confirmExitButton=$('confirmExit');
  if(confirmExitButton){
    const oldConfirmExit=confirmExitButton.onclick;
    confirmExitButton.onclick=function(ev){
      const dup=duplicateCandidateForCurrentExit();
      if(dup){
        const details=aggregateSaleItems(dup).map(x=>x.name+' × '+x.qty).join(', ');
        const proceed=confirm('Attention : une sortie très similaire existe déjà.\\n\\n'+details+'\\nTotal : '+money(dup.amount)+'\\nClient : '+(dup.customerName||dup.customerPhone||'non renseigné')+'\\n\\nVoulez-vous vraiment enregistrer cette sortie une deuxième fois ?');
        if(!proceed)return;
      }
      return oldConfirmExit.call(this,ev);
    };
  }

  renderDuplicateExits();



  /* CAREN_STOCK_AUDIT_V1 */
  const historyAuditPage=$('page-history');
  if(historyAuditPage&&!$('stockAuditList')){
    const ref=$('duplicateExitCard')||$('exitByProductCard')||historyAuditPage.querySelector('.card');
    if(ref){
      ref.insertAdjacentHTML('afterend',
        '<div class="card" id="stockAuditCard">'+
          '<div class="card-head"><h2>Contrôle de cohérence du stock</h2><span class="badge ok" id="stockAuditBadge">0 écart</span></div>'+
          '<p class="section-sub">Calcul : stock de départ estimé + entrées − sorties = stock théorique.</p>'+
          '<div id="stockAuditList"></div>'+
        '</div>'
      );
    }
  }

  function stockAuditForProduct(p){
    const moves=(data.movements||[]).filter(m=>m.productId===p.id).slice().sort((a,b)=>new Date(a.date)-new Date(b.date));
    if(!moves.length){
      return {name:p.name,start:null,ins:0,outs:0,theoretical:Number(p.stock)||0,current:Number(p.stock)||0,diff:0,hasHistory:false};
    }
    const first=moves[0];
    const firstQty=Number(first.qty)||0;
    const firstAfter=Number(first.stockAfter)||0;
    const start=first.type==='IN'?firstAfter-firstQty:firstAfter+firstQty;
    const ins=moves.filter(m=>m.type==='IN').reduce((s,m)=>s+(Number(m.qty)||0),0);
    const outs=moves.filter(m=>m.type==='OUT').reduce((s,m)=>s+(Number(m.qty)||0),0);
    const theoretical=start+ins-outs;
    const current=Number(p.stock)||0;
    return {name:p.name,start,ins,outs,theoretical,current,diff:current-theoretical,hasHistory:true};
  }

  function renderStockAudit(){
    if(!$('stockAuditList'))return;
    const rows=(data.products||[]).map(stockAuditForProduct);
    const discrepancies=rows.filter(x=>x.hasHistory&&x.diff!==0);
    if($('stockAuditBadge')){
      $('stockAuditBadge').textContent=discrepancies.length+' écart'+(discrepancies.length>1?'s':'');
      $('stockAuditBadge').className='badge '+(discrepancies.length?'low':'ok');
    }
    const ordered=rows.slice().sort((a,b)=>{
      const ad=Math.abs(a.diff),bd=Math.abs(b.diff);
      if(bd!==ad)return bd-ad;
      return a.name.localeCompare(b.name);
    });
    $('stockAuditList').innerHTML=ordered.map(x=>{
      const status=!x.hasHistory?'Pas d’historique':x.diff===0?'Cohérent':'Écart '+(x.diff>0?'+':'')+x.diff;
      const badgeClass=!x.hasHistory?'low':x.diff===0?'ok':'zero';
      const calc=x.hasHistory
        ? 'Départ '+x.start+' • Entrées +'+x.ins+' • Sorties −'+x.outs+' • Théorique '+x.theoretical+' • Actuel '+x.current
        : 'Stock actuel '+x.current+' • Impossible de recalculer sans historique';
      return '<div class="product-card" style="align-items:flex-start"><div class="meta"><strong>'+esc(x.name)+'</strong><small>'+esc(calc)+'</small></div><div class="product-stock"><span class="badge '+badgeClass+'">'+esc(status)+'</span></div></div>';
    }).join('');
  }

  const previousRenderHistoryAudit=renderHistory;
  renderHistory=function(){
    previousRenderHistoryAudit();
    renderStockAudit();
  };
  renderStockAudit();



  /* CAREN_STOCK_AUDIT_RELOCATE_V1 */
  function relocateStockAudit(){
    const audit=$('stockAuditCard');
    const productsPage=$('page-products');
    if(!audit||!productsPage)return;
    const firstCard=productsPage.querySelector('.card');
    if(firstCard&&audit.parentElement!==productsPage){
      productsPage.insertBefore(audit,firstCard.nextSibling);
    }
  }
  relocateStockAudit();

  const previousRenderProductsAuditRelocate=renderProducts;
  renderProducts=function(){
    previousRenderProductsAuditRelocate();
    relocateStockAudit();
    renderStockAudit();
  };


  /* CAREN_STOCK_CONSISTENCY_V1 */
  function latestMovementByProduct(){
    const map=new Map();
    for(const m of (data.movements||[])){
      const prev=map.get(m.productId);
      if(!prev||new Date(m.date)>new Date(prev.date))map.set(m.productId,m);
    }
    return map;
  }

  function repairStockFromHistory(){
    // Désactivé : stockAfter est un instantané d'historique, pas une source de vérité
    // fiable quand plusieurs mouvements ont la même date. Le stock courant reste
    // celui de products.stock et chaque entrée/sortie l'ajuste directement.
    return 0;
  }

  function installStockCorrectionButtons(){
    document.querySelectorAll('[data-edit]').forEach(btn=>{
      const cell=btn.closest('.actions');
      if(!cell||cell.querySelector('[data-correct-stock]'))return;
      const p=productById(btn.dataset.edit);if(!p)return;
      const b=document.createElement('button');
      b.className='btn secondary small';
      b.dataset.correctStock=p.id;
      b.textContent='Corriger stock';
      b.onclick=()=>{
        const current=productById(p.id);if(!current)return;
        const raw=prompt('Stock physique réel pour '+current.name+' :',String(current.stock));
        if(raw===null)return;
        const value=nonNegativeInt(raw);
        if(value===null){alert('Le stock doit être un nombre entier positif ou nul.');return}
        if(value===Number(current.stock))return;
        if(!confirm('Remplacer le stock de '+current.name+' par '+value+' ? Une correction sera ajoutée à l’historique.'))return;
        const draft=cloneData(),dp=draft.products.find(x=>x.id===current.id);
        const old=Number(dp.stock)||0;
        const diff=value-old;
        dp.stock=value;
        draft.movements.unshift({
          id:uid(),productId:dp.id,productName:dp.name,
          type:diff>=0?'IN':'OUT',qty:Math.abs(diff),stockAfter:value,
          reason:'Correction inventaire',note:'Stock physique corrigé de '+old+' à '+value,
          date:new Date().toISOString()
        });
        recomputeProductSnapshots(draft,dp.id);
        if(save(draft))alert('Stock corrigé.');
      };
      cell.insertBefore(b,cell.firstChild);
    });
  }

  const previousRenderProductsMobileUx=renderProducts;
  renderProducts=function(){
    previousRenderProductsMobileUx();
    installStockCorrectionButtons();
  };

  const previousPullCloudDataMobileUx=pullCloudData;
  pullCloudData=async function(){
    const result=await previousPullCloudDataMobileUx.apply(this,arguments);
    installStockCorrectionButtons();
    return result;
  };

  setTimeout(()=>{installStockCorrectionButtons()},0);

})();
