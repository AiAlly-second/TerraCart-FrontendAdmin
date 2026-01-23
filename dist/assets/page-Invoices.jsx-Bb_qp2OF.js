import{r as n,j as t}from"./vendor-react-BxN59818.js";import{h as X,E as Z}from"./vendor-BWixxOLW.js";import{a as N}from"./page-CartDetails.jsx-Dbxo37xo.js";const ee=(o=[])=>{const r=new Map;return(o||[]).forEach(p=>{(p?.items||[]).forEach(l=>{if(!l)return;const m=l.name||"Item",u=Number(l.quantity)||0,a=Number(l.price||0)/100,g=!!l.returned;r.has(m)||r.set(m,{name:m,unitPrice:a,quantity:0,returnedQuantity:0,returned:!1,amount:0});const d=r.get(m);g?(d.returnedQuantity+=u,d.returned=!0):(d.quantity+=u,d.amount+=a*u),d.unitPrice||(d.unitPrice=a)})}),Array.from(r.values())},te=(o=[],r=[])=>{const p=r.reduce((a,g)=>{const d=Number(g.amount)||0;return a+d},0),l=Number(p.toFixed(2)),m=Number((l*.05).toFixed(2)),u=Number((l+m).toFixed(2));return{subtotal:l,gst:m,totalAmount:u,totalItems:r.reduce((a,g)=>a+(Number(g.quantity)||0),0)}},j=o=>{const r=Number(o);return Number.isNaN(r)?"0.00":r.toFixed(2)},se=(o,r,p,l,m,u)=>{if(!o)return"";const a=(()=>{const x=new Date(o.createdAt||Date.now()).toISOString().slice(0,10).replace(/-/g,""),y=(o._id||"").toString().slice(-6).toUpperCase();return`INV-${x}-${y}`})(),g=m?.address||"—",d=l?.fssaiNumber||l?.gstNumber||"—",A=u||"CASH",$=r.length>0?r.map(x=>{const y=x.quantity||0,b=x.unitPrice||0,S=x.amount||0;return`
              <tr>
                <td class="py-2 border-b">${x.name||""}</td>
                <td class="py-2 border-b">${y}</td>
                <td class="py-2 border-b">₹${j(b)}</td>
                <td class="py-2 border-b text-right">₹${j(S)}</td>
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
        <div style="font-size: 9px; margin-bottom: 8px;">FSSAI No: ${d}</div>
        <div style="font-size: 11px; font-weight: bold; margin-bottom: 4px; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0;">Invoice</div>
        <div style="font-size: 9px; margin-bottom: 2px;">Invoice No: ${a}</div>
        <div style="font-size: 9px; margin-bottom: 8px;">Date: ${new Date(o.paidAt||o.updatedAt||o.createdAt||Date.now()).toLocaleDateString()}</div>
      </div>
      <div style="margin-bottom: 8px;">
        <div style="font-weight: 600; font-size: 10px; margin-bottom: 4px;">Billed To</div>
        <div style="font-size: 9px;">
          Table ${o.tableNumber||"—"}
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
          ${$}
        </tbody>
      </table>
      <div class="invoice-totals">
        <div class="invoice-totals-inner">
          <div class="invoice-line">
            <span>Subtotal</span>
            <span>₹${j(p.subtotal)}</span>
          </div>
          <div class="invoice-line">
            <span>GST (5%)</span>
            <span>₹${j(p.gst)}</span>
          </div>
          <div class="invoice-line" style="font-weight: 700; border-top: 1px solid #d1d5db; padding-top: 8px; margin-top: 12px;">
            <span>Total</span>
            <span>₹${j(p.totalAmount)}</span>
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
  `},oe=()=>{const[o,r]=n.useState([]),[p,l]=n.useState(!0),[m,u]=n.useState(""),[a,g]=n.useState(null),[d,A]=n.useState(""),[$,x]=n.useState(null),[y,b]=n.useState(null),[S,U]=n.useState({}),[k,M]=n.useState(!1),[R,_]=n.useState(!1),[I,W]=n.useState(""),v=n.useRef(null),z=n.useMemo(()=>ee(a?.kotLines||[]),[a]),B=n.useMemo(()=>te(a?.kotLines||[],z),[a,z]),O=n.useCallback(async()=>{l(!0),u("");try{const{data:e}=await N.get("/orders");r(Array.isArray(e)?e:[])}catch(e){u(e.response?.data?.message||e.message||"Failed to load orders")}finally{l(!1)}},[]),E=n.useCallback(async e=>{if(!e){x(null),b(null);return}x(null),b(null);try{if(e.franchiseId){const s=typeof e.franchiseId=="object"?e.franchiseId._id:e.franchiseId;if(s){const i=await N.get(`/users/${s}`);x(i.data)}}if(e.cartId){const s=typeof e.cartId=="object"?e.cartId._id:e.cartId;if(s){const i=await N.get(`/users/${s}`);b(i.data)}}}catch(s){console.warn("Failed to fetch franchise/cart data for invoice:",s)}},[]),D=n.useCallback(async()=>{M(!0);try{const{data:e}=await N.get("/payments"),s={};(Array.isArray(e)?e:[]).forEach(i=>{const c=i.orderId;c&&(s[c]||(s[c]=[]),s[c].push(i))}),U(s)}catch(e){console.error("Failed to load payments",e)}finally{M(!1)}},[]),G=async()=>{_(!0);try{await N.post("/payments/sync-paid"),await Promise.all([O(),D()]),alert("Synced payment records for paid orders.")}catch(e){alert(e.response?.data?.message||"Failed to sync payments.")}finally{_(!1)}};n.useEffect(()=>{O(),D()},[]),n.useEffect(()=>{a?E(a):(x(null),b(null))},[a,E]);const w=e=>{const s=new Date(e.createdAt||Date.now()).toISOString().slice(0,10).replace(/-/g,""),i=(e._id||"").toString().slice(-6).toUpperCase();return`INV-${s}-${i}`};n.useCallback(w,[]);const q=n.useMemo(()=>{let e=o.filter(s=>(s.status||"").toString().toLowerCase()==="paid");if(d&&(e=e.filter(s=>{const i=new Date(s.createdAt||s.paidAt||s.updatedAt),c=new Date(d);return i.toDateString()===c.toDateString()})),I){const s=I.trim().toLowerCase();e=e.filter(i=>{const c=(i._id||"").toString().toLowerCase().includes(s),C=w(i).toLowerCase().includes(s);return c||C})}return e},[o,d,I]),f=n.useMemo(()=>a?S[a._id]||[]:[],[a,S]),K=n.useMemo(()=>!f||f.length===0?null:(f.find(s=>s.status==="PAID")||f[0]).method||null,[f]),V=()=>{if(!v.current)return;const e=document.createElement("iframe");e.style.position="fixed",e.style.right="0",e.style.bottom="0",e.style.width="0",e.style.height="0",e.style.border="0",document.body.appendChild(e);const s=e.contentWindow?.document;s&&(s.open(),s.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${a?w(a):"Invoice"}</title>
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
    `),s.close(),e.onload=function(){setTimeout(()=>{e.contentWindow?.focus(),e.contentWindow?.print(),document.body.removeChild(e)},50)})},Y=async()=>{if(!v.current||!a)return;const e=v.current,i=(await X(e,{scale:window.devicePixelRatio||2,useCORS:!0,backgroundColor:"#ffffff"})).toDataURL("image/png"),c=new Z({orientation:"portrait",unit:"mm",format:[80,"auto"]}),H=80,C=c.internal.pageSize.getHeight(),h=4,L=H-h*2,Q=c.getImageProperties(i),J=Q.height/Q.width,F=L*J;let P=F,T=h;for(c.addImage(i,"PNG",h,T,L,F),P-=C-h*2;P>0;)c.addPage(),T=h-P,c.addImage(i,"PNG",h,T,L,F),P-=C-h*2;c.save(`${w(a)}.pdf`)};return t.jsxs("div",{className:"p-3 sm:p-4",children:[t.jsxs("div",{className:"mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4",children:[t.jsxs("div",{children:[t.jsx("h1",{className:"text-xl sm:text-2xl md:text-3xl font-bold text-gray-800",children:"Invoices"}),t.jsx("p",{className:"text-xs sm:text-sm text-gray-500 mt-1",children:"Generate printable invoices for Paid orders and keep payment records in sync."})]}),t.jsxs("div",{className:"flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto",children:[t.jsx("input",{type:"text",value:I,onChange:e=>W(e.target.value),className:"px-3 py-2 rounded-lg border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 sm:flex-initial",placeholder:"Search Order ID"}),t.jsx("input",{type:"date",value:d,onChange:e=>A(e.target.value),className:"px-3 py-2 rounded-lg border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 sm:flex-initial",placeholder:"Filter by date"}),t.jsx("button",{onClick:D,className:"px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-lg border border-gray-300 hover:bg-gray-100 whitespace-nowrap",disabled:k,children:k?"Refreshing payments…":"Refresh payments"}),t.jsx("button",{onClick:G,className:"px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap",disabled:R,children:R?"Syncing…":"Sync paid orders"})]})]}),p&&t.jsx("div",{className:"text-sm text-gray-500",children:"Loading paid orders…"}),m&&t.jsx("div",{className:"text-sm text-red-600",children:m}),!p&&!m&&t.jsxs("div",{className:"grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6",children:[t.jsxs("div",{className:"lg:col-span-1 space-y-2 sm:space-y-3",children:[q.length===0&&t.jsx("div",{className:"text-sm text-gray-500",children:"No paid orders match your criteria."}),q.map(e=>t.jsxs("button",{onClick:()=>g(e),className:`w-full text-left p-3 sm:p-4 rounded-lg border shadow-sm hover:shadow transition ${a?._id===e._id?"ring-2 ring-blue-400":""}`,children:[t.jsxs("div",{className:"flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2",children:[t.jsxs("div",{className:"min-w-0 flex-1",children:[t.jsxs("div",{className:"font-semibold text-sm sm:text-base text-gray-800 truncate",children:["Order #",e._id]}),t.jsxs("div",{className:"text-xs sm:text-sm text-gray-500",children:["Table ",e.tableNumber||"—"]}),t.jsxs("div",{className:"text-[10px] sm:text-xs text-gray-400 mt-1",children:[new Date(e.createdAt).toLocaleDateString()," ",new Date(e.createdAt).toLocaleTimeString()]})]}),t.jsx("div",{className:"text-xs sm:text-sm font-mono text-gray-700 flex-shrink-0",children:new Date(e.paidAt||e.updatedAt||e.createdAt).toLocaleDateString()})]}),t.jsx("div",{className:"text-[10px] sm:text-xs text-gray-500 mt-1",children:"Click to preview invoice"})]},e._id))]}),t.jsxs("div",{className:"lg:col-span-2",children:[!a&&t.jsx("div",{className:"text-sm text-gray-500",children:"Select a paid order to preview the invoice."}),a&&t.jsxs("div",{children:[t.jsxs("div",{className:"flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-4 mb-3 sm:mb-4",children:[t.jsxs("div",{className:"flex flex-col sm:flex-row gap-1 sm:gap-2",children:[t.jsx("h2",{className:"text-lg sm:text-xl font-bold text-gray-800",children:"Invoice Preview"}),t.jsxs("p",{className:"text-xs sm:text-sm text-gray-500",children:["Invoice #",w(a)]})]}),t.jsxs("div",{className:"flex gap-2",children:[t.jsx("button",{onClick:V,className:"px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs sm:text-sm",children:"Print"}),t.jsx("button",{onClick:Y,className:"px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700",children:"Download PDF"})]})]}),t.jsxs("div",{className:"mb-4 bg-slate-50 border border-slate-200 rounded-lg p-4",children:[t.jsxs("div",{className:"flex items-center justify-between mb-3",children:[t.jsx("h3",{className:"text-sm font-semibold text-slate-800",children:"Payment records"}),t.jsx("button",{onClick:D,className:"text-xs text-blue-600 hover:text-blue-800",children:"Refresh"})]}),k?t.jsx("p",{className:"text-xs text-slate-500",children:"Loading payment data…"}):f.length===0?t.jsx("p",{className:"text-xs text-slate-500",children:"No payment records found for this order. Use “Sync paid orders” to create payment entries."}):t.jsx("div",{className:"space-y-2 text-xs text-slate-700",children:f.map(e=>t.jsxs("div",{className:"flex flex-col md:flex-row md:items-center md:justify-between gap-1 border border-slate-200 rounded-md px-3 py-2 bg-white",children:[t.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[t.jsx("span",{className:"font-mono text-slate-600",children:e.id}),t.jsx("span",{className:"px-2 py-0.5 rounded-full border border-slate-300 text-slate-600",children:e.method.toLowerCase()}),t.jsx("span",{className:`px-2 py-0.5 rounded-full border ${e.status==="PAID"?"border-green-300 text-green-700 bg-green-50":"border-yellow-300 text-yellow-700 bg-yellow-50"}`,children:e.status.replace("_"," ")})]}),t.jsxs("div",{className:"flex flex-wrap items-center gap-3",children:[t.jsxs("span",{className:"font-semibold text-slate-800",children:["₹",e.amount?.toFixed(2)]}),t.jsx("span",{className:"text-slate-500",children:new Date(e.updatedAt||e.createdAt).toLocaleString()})]})]},e.id))})]}),t.jsx("div",{ref:v,className:"bg-white rounded-lg shadow border",dangerouslySetInnerHTML:{__html:se(a,z,B,$,y,K)}})]})]})]})]})};export{oe as I};
