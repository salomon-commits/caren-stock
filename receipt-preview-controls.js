/* CAREN_RECEIPT_PREVIEW_CONTROLS_V1 */
(function installReceiptPreviewControls(){
  if(typeof printReceipt!=='function')return;
  const originalPrintReceipt=printReceipt;

  printReceipt=function(a){
    let receiptWindow=null;
    const nativeOpen=window.open;

    window.open=function(){
      receiptWindow=nativeOpen.apply(window,arguments);
      return receiptWindow;
    };

    try{
      originalPrintReceipt(a);
    }finally{
      window.open=nativeOpen;
    }

    if(!receiptWindow)return;

    const addBackButton=()=>{
      try{
        const doc=receiptWindow.document;
        const actions=doc.querySelector('.no-print');
        if(!actions||doc.getElementById('receiptBackBtn'))return;

        actions.style.display='flex';
        actions.style.justifyContent='center';
        actions.style.alignItems='center';
        actions.style.gap='8px';
        actions.style.flexWrap='wrap';

        const back=doc.createElement('button');
        back.id='receiptBackBtn';
        back.type='button';
        back.className='btn';
        back.textContent='← Retour à l’application';
        back.style.background='#fff';
        back.style.color='#111';
        back.style.border='1px solid #d1d5db';
        back.onclick=()=>{
          receiptWindow.close();
          window.focus();
        };
        actions.insertBefore(back,actions.firstChild);
      }catch(_){ }
    };

    addBackButton();
    setTimeout(addBackButton,80);
  };
})();