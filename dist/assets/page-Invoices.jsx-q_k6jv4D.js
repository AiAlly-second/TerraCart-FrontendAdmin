import{r as a,j as t}from"./vendor-react-BwCVmJGh.js";import{h as Y,E as J}from"./vendor-ByEsx_6l.js";import{a as L}from"./page-CartDetails.jsx-DBdQmjx8.js";const X=(i=[])=>{const o=new Map;return(i||[]).forEach(m=>{(m?.items||[]).forEach(l=>{if(!l)return;const d=l.name||"Item",x=Number(l.quantity)||0,s=Number(l.price||0)/100,g=!!l.returned;o.has(d)||o.set(d,{name:d,unitPrice:s,quantity:0,returnedQuantity:0,returned:!1,amount:0});const r=o.get(d);g?(r.returnedQuantity+=x,r.returned=!0):(r.quantity+=x,r.amount+=s*x),r.unitPrice||(r.unitPrice=s)})}),Array.from(o.values())},Z=(i=[],o=[])=>{const m=o.reduce((s,g)=>{const r=Number(g.amount)||0;return s+r},0),l=Number(m.toFixed(2)),d=Number((l*.05).toFixed(2)),x=Number((l+d).toFixed(2));return{subtotal:l,gst:d,totalAmount:x,totalItems:o.reduce((s,g)=>s+(Number(g.quantity)||0),0)}},w=i=>{const o=Number(i);return Number.isNaN(o)?"0.00":o.toFixed(2)},ee=(i,o,m,l,d,x)=>{if(!i)return"";const s=(()=>{const p=new Date(i.createdAt||Date.now()).toISOString().slice(0,10).replace(/-/g,""),b=(i._id||"").toString().slice(-6).toUpperCase();return`INV-${p}-${b}`})(),g=d?.address||"—",r=l?.gstNumber||"—",D=x||"CASH",P=o.length>0?o.map(p=>{const b=p.quantity||0,y=p.unitPrice||0,N=p.amount||0;return`
              <tr>
                <td class="py-2 border-b">${p.name||""}</td>
                <td class="py-2 border-b">${b}</td>
                <td class="py-2 border-b">₹${w(y)}</td>
                <td class="py-2 border-b text-right">₹${w(N)}</td>
              </tr>
            `}).join(""):`
        <tr>
          <td colspan="4" class="py-4 text-center text-gray-500 border-b">No items recorded.</td>
        </tr>
      `;return`
    <div class="invoice-root">
      <style>
        .invoice-root {
          font-family: 'Courier New', monospace;
          color: #000000;
          width: 80mm;
          max-width: 302px;
          margin: 0 auto;
          padding: 8px;
          border: none;
          background: #ffffff;
          font-size: 11px;
        }
        .invoice-header {
          display: block;
          margin-bottom: 12px;
          text-align: center;
        }
        .invoice-header h1 {
          margin: 0;
          font-size: 14px;
          font-weight: bold;
        }
        .invoice-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
        }
        .invoice-table th {
          text-align: left;
          padding: 4px 2px;
          border-bottom: 1px dashed #000;
          color: #000;
          font-size: 9px;
        }
        .invoice-table td {
          padding: 3px 2px;
          font-size: 9px;
        }
        .invoice-line {
          margin-top: 6px;
          display: flex;
          justify-content: space-between;
          font-size: 10px;
        }
        .invoice-totals {
          margin-top: 12px;
          width: 100%;
          display: block;
        }
        .invoice-totals-inner {
          width: 100%;
        }
        .invoice-footer {
          margin-top: 16px;
          font-size: 8px;
          color: #000;
          text-align: center;
        }
      </style>
      <div class="invoice-header">
        <div style="font-size: 14px; font-weight: bold; margin-bottom: 4px;">Terra Cart</div>
        <div style="font-size: 9px; margin-bottom: 2px;">${g}</div>
        <div style="font-size: 9px; margin-bottom: 8px;">GSTIN: ${r}</div>
        <div style="font-size: 11px; font-weight: bold; margin-bottom: 4px; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0;">Invoice</div>
        <div style="font-size: 9px; margin-bottom: 2px;">Invoice No: ${s}</div>
        <div style="font-size: 9px; margin-bottom: 8px;">Date: ${new Date(i.paidAt||i.updatedAt||i.createdAt||Date.now()).toLocaleDateString()}</div>
      </div>
      <div style="margin-bottom: 8px;">
        <div style="font-weight: 600; font-size: 10px; margin-bottom: 4px;">Billed To</div>
        <div style="font-size: 9px;">
          Table ${i.tableNumber||"—"}
        </div>
      </div>
      <table class="invoice-table" style="margin-top: 16px;">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Price (₹)</th>
            <th style="text-align:right;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${P}
        </tbody>
      </table>
      <div class="invoice-totals">
        <div class="invoice-totals-inner">
          <div class="invoice-line">
            <span>Subtotal</span>
            <span>₹${w(m.subtotal)}</span>
          </div>
          <div class="invoice-line">
            <span>GST (5%)</span>
            <span>₹${w(m.gst)}</span>
          </div>
          <div class="invoice-line" style="font-weight: 700; border-top: 1px solid #d1d5db; padding-top: 8px; margin-top: 12px;">
            <span>Total</span>
            <span>₹${w(m.totalAmount)}</span>
          </div>
          <div class="invoice-line" style="margin-top: 6px;">
            <span>Payment Mode</span>
            <span>${String(D).toUpperCase()}</span>
          </div>
        </div>
      </div>
      <div class="invoice-footer">
        This is a system generated invoice. Thank you for dining with Terra Cart.
      </div>
    </div>
  `},ne=()=>{const[i,o]=a.useState([]),[m,l]=a.useState(!0),[d,x]=a.useState(""),[s,g]=a.useState(null),[r,D]=a.useState(""),[P,p]=a.useState(null),[b,y]=a.useState(null),[N,G]=a.useState({}),[A,T]=a.useState(!1),[F,M]=a.useState(!1),v=a.useRef(null),C=a.useMemo(()=>X(s?.kotLines||[]),[s]),H=a.useMemo(()=>Z(s?.kotLines||[],C),[s,C]),E=a.useCallback(async()=>{l(!0),x("");try{const{data:e}=await L.get("/orders");o(Array.isArray(e)?e:[])}catch(e){x(e.response?.data?.message||e.message||"Failed to load orders")}finally{l(!1)}},[]),O=a.useCallback(async e=>{if(!e){p(null),y(null);return}p(null),y(null)},[]),j=a.useCallback(async()=>{T(!0);try{const{data:e}=await L.get("/payments"),n={};(Array.isArray(e)?e:[]).forEach(u=>{const c=u.orderId;c&&(n[c]||(n[c]=[]),n[c].push(u))}),G(n)}catch(e){console.error("Failed to load payments",e)}finally{T(!1)}},[]),U=async()=>{M(!0);try{await L.post("/payments/sync-paid"),await Promise.all([E(),j()]),alert("Synced payment records for paid orders.")}catch(e){alert(e.response?.data?.message||"Failed to sync payments.")}finally{M(!1)}};a.useEffect(()=>{E(),j()},[]),a.useEffect(()=>{s?O(s):(p(null),y(null))},[s,O]);const R=a.useMemo(()=>{let e=i.filter(n=>(n.status||"").toString().toLowerCase()==="paid");return r&&(e=e.filter(n=>{const u=new Date(n.createdAt||n.paidAt||n.updatedAt),c=new Date(r);return u.toDateString()===c.toDateString()})),e},[i,r]),h=a.useMemo(()=>s?N[s._id]||[]:[],[s,N]),W=a.useMemo(()=>!h||h.length===0?null:(h.find(n=>n.status==="PAID")||h[0]).method||null,[h]),I=e=>{const n=new Date(e.createdAt||Date.now()).toISOString().slice(0,10).replace(/-/g,""),u=(e._id||"").toString().slice(-6).toUpperCase();return`INV-${n}-${u}`},B=()=>{if(!v.current)return;const e=document.createElement("iframe");e.style.position="fixed",e.style.right="0",e.style.bottom="0",e.style.width="0",e.style.height="0",e.style.border="0",document.body.appendChild(e);const n=e.contentWindow?.document;n&&(n.open(),n.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${s?I(s):"Invoice"}</title>
          <style>
            * { box-sizing: border-box; }
            @media print {
              @page {
                size: 80mm auto;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 0;
              }
            }
            body {
              font-family: 'Courier New', monospace;
              margin: 0; padding: 8px;
              background: white; color: #000;
              width: 80mm;
              max-width: 302px;
              font-size: 11px;
            }
            h1,h2,h3,h4 { margin: 0; }
            table { border-collapse: collapse; width: 100%; font-size: 9px; }
            th, td { padding: 3px 2px; border-bottom: 1px dashed #000; }
            th { text-align: left; font-size: 9px; }
            .invoice {
              width: 80mm;
              max-width: 302px;
              margin: 0 auto;
              padding: 8px;
            }
            .flex { display: flex; justify-content: space-between; }
            .totals div { display: flex; justify-content: space-between; margin-top: 4px; font-size: 10px; }
            .totals div:last-child { font-weight: bold; }
          </style>
        </head>
        <body>
          ${v.current.innerHTML}
        </body>
      </html>
    `),n.close(),e.onload=function(){setTimeout(()=>{e.contentWindow?.focus(),e.contentWindow?.print(),document.body.removeChild(e)},50)})},Q=async()=>{if(!v.current||!s)return;const e=v.current,u=(await Y(e,{scale:window.devicePixelRatio||2,useCORS:!0,backgroundColor:"#ffffff"})).toDataURL("image/png"),c=new J({orientation:"portrait",unit:"mm",format:[80,"auto"]}),K=80,_=c.internal.pageSize.getHeight(),f=4,$=K-f*2,q=c.getImageProperties(u),V=q.height/q.width,k=$*V;let S=k,z=f;for(c.addImage(u,"PNG",f,z,$,k),S-=_-f*2;S>0;)c.addPage(),z=f-S,c.addImage(u,"PNG",f,z,$,k),S-=_-f*2;c.save(`${I(s)}.pdf`)};return t.jsxs("div",{className:"p-3 sm:p-4",children:[t.jsxs("div",{className:"mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4",children:[t.jsxs("div",{children:[t.jsx("h1",{className:"text-xl sm:text-2xl md:text-3xl font-bold text-gray-800",children:"Invoices"}),t.jsx("p",{className:"text-xs sm:text-sm text-gray-500 mt-1",children:"Generate printable invoices for Paid orders and keep payment records in sync."})]}),t.jsxs("div",{className:"flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto",children:[t.jsx("input",{type:"date",value:r,onChange:e=>D(e.target.value),className:"px-3 py-2 rounded-lg border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 sm:flex-initial",placeholder:"Filter by date"}),t.jsx("button",{onClick:j,className:"px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-lg border border-gray-300 hover:bg-gray-100 whitespace-nowrap",disabled:A,children:A?"Refreshing payments…":"Refresh payments"}),t.jsx("button",{onClick:U,className:"px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap",disabled:F,children:F?"Syncing…":"Sync paid orders"})]})]}),m&&t.jsx("div",{className:"text-sm text-gray-500",children:"Loading paid orders…"}),d&&t.jsx("div",{className:"text-sm text-red-600",children:d}),!m&&!d&&t.jsxs("div",{className:"grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6",children:[t.jsxs("div",{className:"lg:col-span-1 space-y-2 sm:space-y-3",children:[R.length===0&&t.jsx("div",{className:"text-sm text-gray-500",children:"No paid orders yet."}),R.map(e=>t.jsxs("button",{onClick:()=>g(e),className:`w-full text-left p-3 sm:p-4 rounded-lg border shadow-sm hover:shadow transition ${s?._id===e._id?"ring-2 ring-blue-400":""}`,children:[t.jsxs("div",{className:"flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2",children:[t.jsxs("div",{className:"min-w-0 flex-1",children:[t.jsxs("div",{className:"font-semibold text-sm sm:text-base text-gray-800 truncate",children:["Order #",e._id]}),t.jsxs("div",{className:"text-xs sm:text-sm text-gray-500",children:["Table ",e.tableNumber||"—"]}),t.jsxs("div",{className:"text-[10px] sm:text-xs text-gray-400 mt-1",children:[new Date(e.createdAt).toLocaleDateString()," ",new Date(e.createdAt).toLocaleTimeString()]})]}),t.jsx("div",{className:"text-xs sm:text-sm font-mono text-gray-700 flex-shrink-0",children:new Date(e.paidAt||e.updatedAt||e.createdAt).toLocaleDateString()})]}),t.jsx("div",{className:"text-[10px] sm:text-xs text-gray-500 mt-1",children:"Click to preview invoice"})]},e._id))]}),t.jsxs("div",{className:"lg:col-span-2",children:[!s&&t.jsx("div",{className:"text-sm text-gray-500",children:"Select a paid order to preview the invoice."}),s&&t.jsxs("div",{children:[t.jsxs("div",{className:"flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-4 mb-3 sm:mb-4",children:[t.jsxs("div",{className:"flex flex-col sm:flex-row gap-1 sm:gap-2",children:[t.jsx("h2",{className:"text-lg sm:text-xl font-bold text-gray-800",children:"Invoice Preview"}),t.jsxs("p",{className:"text-xs sm:text-sm text-gray-500",children:["Invoice #",I(s)]})]}),t.jsxs("div",{className:"flex gap-2",children:[t.jsx("button",{onClick:B,className:"px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs sm:text-sm",children:"Print"}),t.jsx("button",{onClick:Q,className:"px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700",children:"Download PDF"})]})]}),t.jsxs("div",{className:"mb-4 bg-slate-50 border border-slate-200 rounded-lg p-4",children:[t.jsxs("div",{className:"flex items-center justify-between mb-3",children:[t.jsx("h3",{className:"text-sm font-semibold text-slate-800",children:"Payment records"}),t.jsx("button",{onClick:j,className:"text-xs text-blue-600 hover:text-blue-800",children:"Refresh"})]}),A?t.jsx("p",{className:"text-xs text-slate-500",children:"Loading payment data…"}):h.length===0?t.jsx("p",{className:"text-xs text-slate-500",children:"No payment records found for this order. Use “Sync paid orders” to create payment entries."}):t.jsx("div",{className:"space-y-2 text-xs text-slate-700",children:h.map(e=>t.jsxs("div",{className:"flex flex-col md:flex-row md:items-center md:justify-between gap-1 border border-slate-200 rounded-md px-3 py-2 bg-white",children:[t.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[t.jsx("span",{className:"font-mono text-slate-600",children:e.id}),t.jsx("span",{className:"px-2 py-0.5 rounded-full border border-slate-300 text-slate-600",children:e.method.toLowerCase()}),t.jsx("span",{className:`px-2 py-0.5 rounded-full border ${e.status==="PAID"?"border-green-300 text-green-700 bg-green-50":"border-yellow-300 text-yellow-700 bg-yellow-50"}`,children:e.status.replace("_"," ")})]}),t.jsxs("div",{className:"flex flex-wrap items-center gap-3",children:[t.jsxs("span",{className:"font-semibold text-slate-800",children:["₹",e.amount?.toFixed(2)]}),t.jsx("span",{className:"text-slate-500",children:new Date(e.updatedAt||e.createdAt).toLocaleString()})]})]},e.id))})]}),t.jsx("div",{ref:v,className:"bg-white rounded-lg shadow border",dangerouslySetInnerHTML:{__html:ee(s,C,H,P,b,W)}})]})]})]})]})};export{ne as I};
