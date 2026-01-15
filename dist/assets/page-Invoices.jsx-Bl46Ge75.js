import{r as n,j as t}from"./vendor-react-BuR9BM08.js";import{h as X,E as Z}from"./vendor-DvkmTvvO.js";import{a as M}from"./page-CartDetails.jsx-74DKdYoL.js";const ee=(i=[])=>{const o=new Map;return(i||[]).forEach(x=>{(x?.items||[]).forEach(d=>{if(!d)return;const c=d.name||"Item",p=Number(d.quantity)||0,s=Number(d.price||0)/100,g=!!d.returned;o.has(c)||o.set(c,{name:c,unitPrice:s,quantity:0,returnedQuantity:0,returned:!1,amount:0});const r=o.get(c);g?(r.returnedQuantity+=p,r.returned=!0):(r.quantity+=p,r.amount+=s*p),r.unitPrice||(r.unitPrice=s)})}),Array.from(o.values())},te=(i=[],o=[])=>{const x=o.reduce((s,g)=>{const r=Number(g.amount)||0;return s+r},0),d=Number(x.toFixed(2)),c=Number((d*.05).toFixed(2)),p=Number((d+c).toFixed(2));return{subtotal:d,gst:c,totalAmount:p,totalItems:o.reduce((s,g)=>s+(Number(g.quantity)||0),0)}},N=i=>{const o=Number(i);return Number.isNaN(o)?"0.00":o.toFixed(2)},se=(i,o,x,d,c,p)=>{if(!i)return"";const s=(()=>{const u=new Date(i.createdAt||Date.now()).toISOString().slice(0,10).replace(/-/g,""),b=(i._id||"").toString().slice(-6).toUpperCase();return`INV-${u}-${b}`})(),g=c?.address||"—",r=d?.gstNumber||"—",A=p||"CASH",I=o.length>0?o.map(u=>{const b=u.quantity||0,y=u.unitPrice||0,j=u.amount||0;return`
              <tr>
                <td class="py-2 border-b">${u.name||""}</td>
                <td class="py-2 border-b">${b}</td>
                <td class="py-2 border-b">₹${N(y)}</td>
                <td class="py-2 border-b text-right">₹${N(j)}</td>
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
          ${I}
        </tbody>
      </table>
      <div class="invoice-totals">
        <div class="invoice-totals-inner">
          <div class="invoice-line">
            <span>Subtotal</span>
            <span>₹${N(x.subtotal)}</span>
          </div>
          <div class="invoice-line">
            <span>GST (5%)</span>
            <span>₹${N(x.gst)}</span>
          </div>
          <div class="invoice-line" style="font-weight: 700; border-top: 1px solid #d1d5db; padding-top: 8px; margin-top: 12px;">
            <span>Total</span>
            <span>₹${N(x.totalAmount)}</span>
          </div>
          <div class="invoice-line" style="margin-top: 6px;">
            <span>Payment Mode</span>
            <span>${String(A).toUpperCase()}</span>
          </div>
        </div>
      </div>
      <div class="invoice-footer">
        This is a system generated invoice. Thank you for dining with Terra Cart.
      </div>
    </div>
  `},oe=()=>{const[i,o]=n.useState([]),[x,d]=n.useState(!0),[c,p]=n.useState(""),[s,g]=n.useState(null),[r,A]=n.useState(""),[I,u]=n.useState(null),[b,y]=n.useState(null),[j,Q]=n.useState({}),[k,F]=n.useState(!1),[O,E]=n.useState(!1),[S,U]=n.useState(""),v=n.useRef(null),$=n.useMemo(()=>ee(s?.kotLines||[]),[s]),W=n.useMemo(()=>te(s?.kotLines||[],$),[s,$]),R=n.useCallback(async()=>{d(!0),p("");try{const{data:e}=await M.get("/orders");o(Array.isArray(e)?e:[])}catch(e){p(e.response?.data?.message||e.message||"Failed to load orders")}finally{d(!1)}},[]),_=n.useCallback(async e=>{if(!e){u(null),y(null);return}u(null),y(null)},[]),D=n.useCallback(async()=>{F(!0);try{const{data:e}=await M.get("/payments"),a={};(Array.isArray(e)?e:[]).forEach(m=>{const l=m.orderId;l&&(a[l]||(a[l]=[]),a[l].push(m))}),Q(a)}catch(e){console.error("Failed to load payments",e)}finally{F(!1)}},[]),B=async()=>{E(!0);try{await M.post("/payments/sync-paid"),await Promise.all([R(),D()]),alert("Synced payment records for paid orders.")}catch(e){alert(e.response?.data?.message||"Failed to sync payments.")}finally{E(!1)}};n.useEffect(()=>{R(),D()},[]),n.useEffect(()=>{s?_(s):(u(null),y(null))},[s,_]);const w=e=>{const a=new Date(e.createdAt||Date.now()).toISOString().slice(0,10).replace(/-/g,""),m=(e._id||"").toString().slice(-6).toUpperCase();return`INV-${a}-${m}`};n.useCallback(w,[]);const q=n.useMemo(()=>{let e=i.filter(a=>(a.status||"").toString().toLowerCase()==="paid");if(r&&(e=e.filter(a=>{const m=new Date(a.createdAt||a.paidAt||a.updatedAt),l=new Date(r);return m.toDateString()===l.toDateString()})),S){const a=S.trim().toLowerCase();e=e.filter(m=>{const l=(m._id||"").toString().toLowerCase().includes(a),C=w(m).toLowerCase().includes(a);return l||C})}return e},[i,r,S]),h=n.useMemo(()=>s?j[s._id]||[]:[],[s,j]),K=n.useMemo(()=>!h||h.length===0?null:(h.find(a=>a.status==="PAID")||h[0]).method||null,[h]),V=()=>{if(!v.current)return;const e=document.createElement("iframe");e.style.position="fixed",e.style.right="0",e.style.bottom="0",e.style.width="0",e.style.height="0",e.style.border="0",document.body.appendChild(e);const a=e.contentWindow?.document;a&&(a.open(),a.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${s?w(s):"Invoice"}</title>
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
    `),a.close(),e.onload=function(){setTimeout(()=>{e.contentWindow?.focus(),e.contentWindow?.print(),document.body.removeChild(e)},50)})},Y=async()=>{if(!v.current||!s)return;const e=v.current,m=(await X(e,{scale:window.devicePixelRatio||2,useCORS:!0,backgroundColor:"#ffffff"})).toDataURL("image/png"),l=new Z({orientation:"portrait",unit:"mm",format:[80,"auto"]}),G=80,C=l.internal.pageSize.getHeight(),f=4,z=G-f*2,H=l.getImageProperties(m),J=H.height/H.width,L=z*J;let P=L,T=f;for(l.addImage(m,"PNG",f,T,z,L),P-=C-f*2;P>0;)l.addPage(),T=f-P,l.addImage(m,"PNG",f,T,z,L),P-=C-f*2;l.save(`${w(s)}.pdf`)};return t.jsxs("div",{className:"p-3 sm:p-4",children:[t.jsxs("div",{className:"mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4",children:[t.jsxs("div",{children:[t.jsx("h1",{className:"text-xl sm:text-2xl md:text-3xl font-bold text-gray-800",children:"Invoices"}),t.jsx("p",{className:"text-xs sm:text-sm text-gray-500 mt-1",children:"Generate printable invoices for Paid orders and keep payment records in sync."})]}),t.jsxs("div",{className:"flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto",children:[t.jsx("input",{type:"text",value:S,onChange:e=>U(e.target.value),className:"px-3 py-2 rounded-lg border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 sm:flex-initial",placeholder:"Search Order ID"}),t.jsx("input",{type:"date",value:r,onChange:e=>A(e.target.value),className:"px-3 py-2 rounded-lg border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 sm:flex-initial",placeholder:"Filter by date"}),t.jsx("button",{onClick:D,className:"px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-lg border border-gray-300 hover:bg-gray-100 whitespace-nowrap",disabled:k,children:k?"Refreshing payments…":"Refresh payments"}),t.jsx("button",{onClick:B,className:"px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap",disabled:O,children:O?"Syncing…":"Sync paid orders"})]})]}),x&&t.jsx("div",{className:"text-sm text-gray-500",children:"Loading paid orders…"}),c&&t.jsx("div",{className:"text-sm text-red-600",children:c}),!x&&!c&&t.jsxs("div",{className:"grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6",children:[t.jsxs("div",{className:"lg:col-span-1 space-y-2 sm:space-y-3",children:[q.length===0&&t.jsx("div",{className:"text-sm text-gray-500",children:"No paid orders match your criteria."}),q.map(e=>t.jsxs("button",{onClick:()=>g(e),className:`w-full text-left p-3 sm:p-4 rounded-lg border shadow-sm hover:shadow transition ${s?._id===e._id?"ring-2 ring-blue-400":""}`,children:[t.jsxs("div",{className:"flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2",children:[t.jsxs("div",{className:"min-w-0 flex-1",children:[t.jsxs("div",{className:"font-semibold text-sm sm:text-base text-gray-800 truncate",children:["Order #",e._id]}),t.jsxs("div",{className:"text-xs sm:text-sm text-gray-500",children:["Table ",e.tableNumber||"—"]}),t.jsxs("div",{className:"text-[10px] sm:text-xs text-gray-400 mt-1",children:[new Date(e.createdAt).toLocaleDateString()," ",new Date(e.createdAt).toLocaleTimeString()]})]}),t.jsx("div",{className:"text-xs sm:text-sm font-mono text-gray-700 flex-shrink-0",children:new Date(e.paidAt||e.updatedAt||e.createdAt).toLocaleDateString()})]}),t.jsx("div",{className:"text-[10px] sm:text-xs text-gray-500 mt-1",children:"Click to preview invoice"})]},e._id))]}),t.jsxs("div",{className:"lg:col-span-2",children:[!s&&t.jsx("div",{className:"text-sm text-gray-500",children:"Select a paid order to preview the invoice."}),s&&t.jsxs("div",{children:[t.jsxs("div",{className:"flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-4 mb-3 sm:mb-4",children:[t.jsxs("div",{className:"flex flex-col sm:flex-row gap-1 sm:gap-2",children:[t.jsx("h2",{className:"text-lg sm:text-xl font-bold text-gray-800",children:"Invoice Preview"}),t.jsxs("p",{className:"text-xs sm:text-sm text-gray-500",children:["Invoice #",w(s)]})]}),t.jsxs("div",{className:"flex gap-2",children:[t.jsx("button",{onClick:V,className:"px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs sm:text-sm",children:"Print"}),t.jsx("button",{onClick:Y,className:"px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700",children:"Download PDF"})]})]}),t.jsxs("div",{className:"mb-4 bg-slate-50 border border-slate-200 rounded-lg p-4",children:[t.jsxs("div",{className:"flex items-center justify-between mb-3",children:[t.jsx("h3",{className:"text-sm font-semibold text-slate-800",children:"Payment records"}),t.jsx("button",{onClick:D,className:"text-xs text-blue-600 hover:text-blue-800",children:"Refresh"})]}),k?t.jsx("p",{className:"text-xs text-slate-500",children:"Loading payment data…"}):h.length===0?t.jsx("p",{className:"text-xs text-slate-500",children:"No payment records found for this order. Use “Sync paid orders” to create payment entries."}):t.jsx("div",{className:"space-y-2 text-xs text-slate-700",children:h.map(e=>t.jsxs("div",{className:"flex flex-col md:flex-row md:items-center md:justify-between gap-1 border border-slate-200 rounded-md px-3 py-2 bg-white",children:[t.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[t.jsx("span",{className:"font-mono text-slate-600",children:e.id}),t.jsx("span",{className:"px-2 py-0.5 rounded-full border border-slate-300 text-slate-600",children:e.method.toLowerCase()}),t.jsx("span",{className:`px-2 py-0.5 rounded-full border ${e.status==="PAID"?"border-green-300 text-green-700 bg-green-50":"border-yellow-300 text-yellow-700 bg-yellow-50"}`,children:e.status.replace("_"," ")})]}),t.jsxs("div",{className:"flex flex-wrap items-center gap-3",children:[t.jsxs("span",{className:"font-semibold text-slate-800",children:["₹",e.amount?.toFixed(2)]}),t.jsx("span",{className:"text-slate-500",children:new Date(e.updatedAt||e.createdAt).toLocaleString()})]})]},e.id))})]}),t.jsx("div",{ref:v,className:"bg-white rounded-lg shadow border",dangerouslySetInnerHTML:{__html:se(s,$,W,I,b,K)}})]})]})]})]})};export{oe as I};
