const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/page-AttendanceManagement.jsx-cGe0zLIE.js","assets/vendor-react-BxN59818.js","assets/vendor-BWixxOLW.js"])))=>i.map(i=>d[i]);
import{_ as ot}from"./page-AttendanceManagement.jsx-cGe0zLIE.js";import{I as dt,a as ct,r as b,j as e,X as mt}from"./vendor-react-BxN59818.js";import{l as xt}from"./vendor-socket-CJGQfG0B.js";import"./vendor-BWixxOLW.js";import{a as N}from"./page-CartDetails.jsx-Dbxo37xo.js";import{u as pt}from"./page-Carts.jsx-CKF-d86g.js";const ut=()=>"https://api.terracart.in",bt=(l={})=>{const p=ut(),h="https://api.terracart.in",c=typeof window<"u"&&window.location.origin!==new URL(p,window.location.href).origin,u=h.includes("onrender.com"),g=u?12e4:6e4,f={transports:["polling","websocket"],autoConnect:!0,reconnection:!0,reconnectionDelay:u?2e3:1e3,reconnectionDelayMax:u?1e4:5e3,reconnectionAttempts:u?10:5,timeout:g,connectTimeout:g,upgradeTimeout:3e4,...l};c&&(f.withCredentials=!0);const v=xt(p,f);let I=0;const T=1e4;return v.on("connect_error",C=>{const z=Date.now();z-I>T&&(I=z,C.message?.includes("timeout")||C.type==="TransportError"||C.message?.includes("xhr poll error")||C.message?.includes("CORS")||C.message?.includes("Not allowed by CORS"))}),v.on("connect",()=>{}),v.on("disconnect",C=>{C==="io server disconnect"&&v.connect()}),v.on("reconnect_attempt",C=>{}),v.on("reconnect",C=>{}),v.on("reconnect_failed",()=>{}),v};let ke=null;const ft=()=>(ke||(ke=bt()),ke),ht={Pending:"Confirmed",Confirmed:"Preparing",Preparing:"Ready",Ready:"Served",Served:"Paid",Paid:null,Cancelled:null,Returned:null,Finalized:"Paid"},gt=(l,p="DINE_IN")=>p==="TAKEAWAY"&&l==="Ready"?"Paid":ht[l]||null,yt=l=>l!=="Paid"&&l!=="Cancelled"&&l!=="Returned",wt=l=>l==="Paid",Ae=l=>l==="Confirmed",Nt="Preparing",me=new Map,vt=l=>{const p=me.get(l);p&&(p.abort(),me.delete(l))},jt=l=>{vt(l);const p=new AbortController;return me.set(l,p),p},Te=l=>{me.delete(l)},Ye=async(l,p)=>{const h=jt(l);try{const c=await p(h.signal);return Te(l),c}catch(c){throw c.name==="AbortError"||c.code==="ERR_CANCELED",Te(l),c}},Se="/assets/Attached_image-removebg-preview-CShoJhhO.png",Be=(l,p,h=0)=>{if(!l||!p)return;const c=document.createElement("iframe");c.style.position="fixed",c.style.right="0",c.style.bottom="0",c.style.width="0",c.style.height="0",c.style.border="0",document.body.appendChild(c);const u=c.contentWindow?.document;if(!u)return;const g=`
    <!DOCTYPE html>
    <html>
      <head>
        <title>KOT #${h+1} - ${l._id}</title>
        <style>
          @media print {
            @page {
              size: 80mm auto; /* Standard thermal paper width */
              margin: 0;
            }
            body {
              margin: 0;
              padding: 5px;
            }
          }
          body {
            font-family: 'Courier New', monospace;
            width: 80mm;
            max-width: 302px;
            margin: 0 auto;
            background: #fff;
            color: #000;
            font-size: 11px;
            line-height: 1.3;
          }
          .header {
            text-align: center;
            border-bottom: 3px double #000;
            padding-bottom: 8px;
            margin-bottom: 8px;
          }
          .header h1 {
            margin: 0 0 4px 0;
            font-size: 14px;
            font-weight: bold;
            letter-spacing: 1px;
          }
          .header h2 {
            margin: 0;
            font-size: 11px;
            font-weight: bold;
            border: 2px solid #000;
            padding: 4px;
            display: inline-block;
          }
          .kot-number {
            text-align: center;
            font-size: 16px;
            font-weight: bold;
            margin: 8px 0;
            padding: 6px;
            background: #000;
            color: #fff;
          }
          .service-badge {
            text-align: center;
            font-size: 13px;
            font-weight: bold;
            margin: 8px 0;
            padding: 5px;
            border: 2px dashed #000;
          }
          .service-badge.takeaway {
            background: #f0f0f0;
          }
          .info {
            margin-bottom: 8px;
            font-size: 11px;
            border-bottom: 1px dashed #000;
            padding-bottom: 6px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin: 2px 0;
          }
          .info-label {
            font-weight: bold;
          }
          .highlight-box {
            border: 4px double #000;
            padding: 8px;
            margin: 8px 0;
            text-align: center;
            background: #f5f5f5;
          }
          .highlight-box .label {
            font-size: 11px;
            font-weight: bold;
            display: block;
            margin-bottom: 3px;
          }
          .highlight-box .value {
            font-size: 18px;
            font-weight: bold;
            letter-spacing: 2px;
          }
          .section-title {
            text-align: center;
            font-weight: bold;
            font-size: 12px;
            margin: 10px 0 6px 0;
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
            padding: 4px;
          }
          .items-table {
            width: 100%

;
            border-collapse: collapse;
            margin: 6px 0;
          }
          .items-table th {
            text-align: left;
            border-bottom: 2px solid #000;
            padding: 4px 2px;
            font-weight: bold;
            font-size: 10px;
          }
          .items-table td {
            text-align: left;
            padding: 6px 2px;
            vertical-align: top;
            border-bottom: 1px dotted #ccc;
          }
          .qty {
            width: 20%;
            font-weight: bold;
            font-size: 13px;
          }
          .item-name {
            width: 80%;
            font-size: 12px;
          }
          .item-note {
            font-size: 10px;
            color: #333;
            font-style: italic;
            padding-left: 10px;
            margin-top: 2px;
          }
          .summary {
            border-top: 2px solid #000;
            margin-top: 8px;
            padding-top: 6px;
            text-align: center;
            font-weight: bold;
          }
          .footer {
            border-top: 3px double #000;
            margin-top: 10px;
            padding-top: 6px;
            text-align: center;
            font-style: italic;
            font-size: 10px;
          }
          .footer .message {
            font-weight: bold;
            margin-bottom: 2px;
          }
          .badge {
            font-weight: bold;
            display: inline-block;
            margin-left: 5px;
            padding: 2px 5px;
            background: #000;
            color: #fff;
            font-size: 9px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>** TERRA CART **</h1>
          <h2>KITCHEN ORDER TICKET</h2>
        </div>

        <div class="kot-number">
          KOT #${String(h+1).padStart(3,"0")}
        </div>

        <div class="service-badge ${l.serviceType==="TAKEAWAY"?"takeaway":""}">
          ${l.serviceType==="TAKEAWAY"?"*** TAKEAWAY ORDER ***":"~~~ DINE-IN ORDER ~~~"}
        </div>

        <div class="info">
          <div class="info-row">
            <span class="info-label">Date:</span>
            <span>${new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Time:</span>
            <span>${new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:!0})}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Order Ref:</span>
            <span>${(l._id||"").toString().slice(-8).toUpperCase()}</span>
          </div>
        </div>

        ${l.serviceType==="TAKEAWAY"&&l.takeawayToken?`
        <div class="highlight-box">
          <span class="label">TOKEN NUMBER</span>
          <span class="value">${l.takeawayToken.toUpperCase()}</span>
        </div>
        `:l.tableNumber?`
        <div class="highlight-box">
          <span class="label">TABLE NUMBER</span>
          <span class="value">${l.tableNumber}</span>
        </div>
        `:""}

        ${l.serviceType==="TAKEAWAY"&&(l.customerName||l.customerMobile)?`
        <div class="info" style="border-top: 1px solid #000; padding-top: 6px;">
          ${l.customerName?`
          <div class="info-row">
            <span class="info-label">Customer:</span>
            <span>${l.customerName}</span>
          </div>
          `:""}
          ${l.customerMobile?`
          <div class="info-row">
            <span class="info-label">Mobile:</span>
            <span>${l.customerMobile}</span>
          </div>
          `:""}
        </div>
        `:""}

        <div class="section-title">ITEMS TO PREPARE</div>

        <table class="items-table">
          <thead>
            <tr>
              <th class="qty">Qty</th>
              <th class="item-name">Item</th>
            </tr>
          </thead>
          <tbody>
            ${(p.items||[]).map(f=>{if(f.returned)return`
                <tr style="text-decoration: line-through; opacity: 0.6;">
                  <td class="qty" colspan="2">✗ CANCELLED: ${f.name}</td>
                </tr>
                `;const v=f.convertedToTakeaway===!0;return`
              <tr>
                <td class="qty">[${f.quantity}x]</td>
                <td class="item-name">
                  <strong>${f.name}</strong>
                  ${v?'<span class="badge">TAKEAWAY</span>':""}
                  ${f.specialInstructions?`<div class="item-note">Note: ${f.specialInstructions}</div>`:""}
                </td>
              </tr>
              `}).join("")}
          </tbody>
        </table>

        <div class="summary">
          ${(()=>{const f=(p.items||[]).filter(I=>!I.returned),v=f.reduce((I,T)=>I+(T.quantity||0),0);return`Total Items: ${f.length} | Total Qty: ${v}`})()}
        </div>

        <div class="footer">
          <div class="message">Prepare with care!</div>
          <div>Terra Cart Kitchen</div>
        </div>
      </body>
    </html>
  `;u.open(),u.write(g),u.close(),c.onload=function(){setTimeout(()=>{c.contentWindow?.focus(),c.contentWindow?.print(),setTimeout(()=>{document.body.contains(c)&&document.body.removeChild(c)},1e3)},100)}},It=()=>{const l="https://api.terracart.in";return l.match(/^https?:\/\//)?l:`http://${l}`},Ct=It().replace(/\/$/,""),M=ft(),V=l=>{if(!l)return"";const p=new Date(l.createdAt||Date.now()).toISOString().slice(0,10).replace(/-/g,""),h=(l._id||"").toString().slice(-6).toUpperCase();return`INV-${p}-${h}`},j=l=>{const p=Number(l);return Number.isNaN(p)?"0.00":p.toFixed(2)},Qe=l=>{if(l==null)return 0;const p=Number(l);return Number.isNaN(p)?0:p/100},Ve=l=>typeof l=="string"?l:l?.toString?.()||"",kt=(l=[])=>{const p=[],h=[];return(l||[]).forEach(c=>{(c?.items||[]).forEach(u=>{if(!u||u.returned)return;const g=u.name||"Item",f=Number(u.quantity)||0,v=Qe(u.price||0),I=v*f,T=u.convertedToTakeaway===!0,C={name:g,unitPrice:v,quantity:f,amount:I,isTakeaway:T};T?h.push(C):p.push(C)})}),{dineInItems:p,takeawayItems:h}},At=(l=[],p=[])=>{let h=[];Array.isArray(p)?h=p:p&&typeof p=="object"&&(h=[...p.dineInItems||[],...p.takeawayItems||[]]);const c=h.reduce((v,I)=>{const T=Number(I.amount)||0;return v+T},0),u=Number(c.toFixed(2)),g=Number((u*.05).toFixed(2)),f=Number((u+g).toFixed(2));return{subtotal:u,gst:g,totalAmount:f}},Tt=(l,p=null,h=null)=>{if(!l)return"";const c=V(l),u=Array.isArray(l.kotLines)?l.kotLines:[],{dineInItems:g,takeawayItems:f}=kt(u),v=[...g,...f],I=At(u,v),T=h?.address||"—",C=p?.fssaiNumber||p?.gstNumber||"—",z=l.paymentMethod||l.paymentMode||l.payment&&l.payment.method||"CASH",_=g.length>0?g.map(m=>{const A=m.quantity||0,R=m.unitPrice||0,Q=m.amount||0;return`
            <tr>
              <td class="py-2 border-b">${m.name||""}</td>
              <td class="py-2 border-b">${A}</td>
              <td class="py-2 border-b">₹${j(R)}</td>
              <td class="py-2 border-b text-right">₹${j(Q)}</td>
            </tr>
          `}).join(""):"",F=f.length>0?f.map(m=>{const A=m.quantity||0,R=m.unitPrice||0,Q=m.amount||0;return`
            <tr>
              <td class="py-2 border-b">${m.name||""} <span style="color: #059669; font-weight: bold;">📦 TAKEAWAY</span></td>
              <td class="py-2 border-b">${A}</td>
              <td class="py-2 border-b">₹${j(R)}</td>
              <td class="py-2 border-b text-right">₹${j(Q)}</td>
            </tr>
          `}).join(""):"",$=_+F?`
      ${_?`<tr><td colspan="4" style="padding-top: 8px; font-weight: bold; font-size: 10px; color: #1f2937;">DINE-IN ITEMS</td></tr>${_}`:""}
      ${F?`<tr><td colspan="4" style="padding-top: 8px; font-weight: bold; font-size: 10px; color: #059669;">TAKEAWAY ITEMS</td></tr>${F}`:""}
    `:`
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
        <div style="font-size: 9px; margin-bottom: 2px;">${T}</div>
        <div style="font-size: 9px; margin-bottom: 8px;">FSSAI No: ${C}</div>
        <div style="font-size: 11px; font-weight: bold; margin-bottom: 4px; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0;">Invoice</div>
        <div style="font-size: 9px; margin-bottom: 2px;">Invoice No: ${c}</div>
        <div style="font-size: 9px; margin-bottom: 8px;">Date: ${new Date(l.paidAt||l.updatedAt||l.createdAt||Date.now()).toLocaleDateString()}</div>
        </div>
      <div style="margin-bottom: 8px;">
        <div style="font-weight: 600; font-size: 10px; margin-bottom: 4px;">Billed To</div>
        <div style="font-size: 9px;">
          Table ${l.tableNumber||"—"}
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
            <span>₹${j(I.subtotal)}</span>
          </div>
          <div class="invoice-line">
            <span>GST (5%)</span>
            <span>₹${j(I.gst)}</span>
          </div>
          <div class="invoice-line" style="font-weight: 700; border-top: 1px solid #d1d5db; padding-top: 8px; margin-top: 12px;">
            <span>Total</span>
            <span>₹${j(I.totalAmount)}</span>
          </div>
          <div class="invoice-line" style="margin-top: 6px;">
            <span>Payment Mode</span>
            <span>${String(z).toUpperCase()}</span>
          </div>
        </div>
      </div>
      <div class="invoice-footer">
        This is a system generated invoice. Thank you for dining with Terra Cart.
      </div>
    </div>
  `},St=async l=>{if(!l)return;let p=null,h=null;try{if(l.franchiseId){const f=await N.get(`/users/${l.franchiseId}`);f.data&&(p={gstNumber:f.data.gstNumber||null,fssaiNumber:f.data.fssaiNumber||null,name:f.data.name||null})}if(l.cartId){const f=await N.get(`/users/${l.cartId}`);f.data&&(h={address:f.data.address||f.data.location||null,cartName:f.data.cartName||f.data.name||null})}}catch{}const c=Tt(l,p,h),u=document.createElement("iframe");u.style.position="fixed",u.style.right="0",u.style.bottom="0",u.style.width="0",u.style.height="0",u.style.border="0",document.body.appendChild(u);const g=u.contentWindow?.document;g&&(g.open(),g.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${V(l)}</title>
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
        ${c}
      </body>
    </html>
  `),g.close(),u.onload=function(){setTimeout(()=>{u.contentWindow?.focus(),u.contentWindow?.print(),document.body.removeChild(u)},50)})},Dt=()=>{const[l]=dt(),p=ct(),{user:h}=pt(),c=l.get("cafeId"),[u,g]=b.useState([]),[f,v]=b.useState(null),[I,T]=b.useState([]),[C,z]=b.useState({}),[_,F]=b.useState({}),[Ee,$]=b.useState(!1),[m,A]=b.useState(null),[R,Q]=b.useState(""),[xe,Ge]=b.useState(""),[pe,He]=b.useState(""),[G,Je]=b.useState(""),[_e,Xe]=b.useState({}),[q,$e]=b.useState("all"),[se,Oe]=b.useState(!1),[H,ue]=b.useState(""),[K,be]=b.useState([]),[fe,he]=b.useState([]),[O,Pe]=b.useState([]),[ge,Re]=b.useState(!1),[ae,ye]=b.useState({}),[ne,J]=b.useState(""),[X,Z]=b.useState("all"),[re,we]=b.useState(""),[S,De]=b.useState("DINE_IN"),[Le,Me]=b.useState(!1),[ze,D]=b.useState(""),[U,Ze]=b.useState(()=>localStorage.getItem("autoPrintKOT")!=="false"),et=()=>{Ze(t=>{const s=!t;return localStorage.setItem("autoPrintKOT",s),s})},ie=b.useCallback(t=>{if(!t||!t.kotLines||!Array.isArray(t.kotLines))return;const s=t.kotLines.length-1;if(s>=0){const o=t.kotLines[s];o.items&&o.items.length>0&&(console.log(`[AutoPrint] Printing KOT #${s+1} for Order ${t._id}`),Be(t,o,s))}},[]),ee=b.useCallback((t,{prepend:s=!1}={})=>{if(!t||t.serviceType!=="DINE_IN")return;const o=Ve(t._id);o&&g(n=>{const r=[...Array.isArray(n)?n.filter(d=>d.serviceType==="DINE_IN"):[]],i=r.findIndex(d=>Ve(d._id)===o);return i>=0?(r[i]=t,r):s?[t,...r]:[...r,t]})},[]),Fe=t=>{switch(t){case"Paid":return"bg-green-100 text-green-800 border-green-200";case"Confirmed":return"bg-yellow-100 text-yellow-800 border-yellow-200";case"Preparing":return"bg-blue-100 text-blue-800 border-blue-200";case"Ready":return"bg-purple-100 text-purple-800 border-purple-200";case"Served":return"bg-indigo-100 text-indigo-800 border-indigo-200";case"Finalized":return"bg-blue-100 text-blue-800 border-blue-200";case"Pending":return"bg-orange-100 text-orange-800 border-orange-200";case"Cancelled":return"bg-red-100 text-red-800 border-red-200";case"Returned":return"bg-rose-100 text-rose-800 border-rose-200";default:return"bg-gray-100 text-gray-800 border-gray-200"}},Ne=t=>{switch(t){case"Paid":return"✅";case"Confirmed":return"👨‍🍳";case"Preparing":return"🔥";case"Ready":return"🍽️";case"Served":return"🤝";case"Finalized":return"✨";case"Pending":return"⏳";case"Cancelled":return"❌";case"Returned":return"↩️";default:return"⚪"}},tt=t=>{Xe(s=>({...s,[t]:!s[t]}))},le=async(t,s)=>{const o=`order-status-${t}`;try{const n=await Ye(o,async a=>await N.patch(`/orders/${t}/status`,{status:s},{signal:a}));ee(n.data)}catch(n){if(n.name==="AbortError")return;const a=n.response?.data?.message||n.message||"Status update failed";alert(`Failed to change status: ${a}`)}},st=t=>{Ae(t.status)&&le(t._id,Nt)},qe=t=>{const s=new Date(t.createdAt),o=s.toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"}),n=s.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});return e.jsxs(mt.Fragment,{children:[e.jsxs("tr",{className:`hover:bg-gray-50 ${t.status==="Pending"?"bg-orange-50":""}`,children:[e.jsxs("td",{className:"px-2 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-xs sm:text-sm",children:[e.jsx("div",{className:"font-mono text-[9px] text-gray-400 mb-1 select-all",title:"Order ID",children:t._id}),e.jsxs("button",{onClick:()=>tt(t._id),className:"flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1 md:gap-2 w-full sm:w-auto text-left",children:[e.jsx("span",{className:"font-mono text-[9px] sm:text-[10px] md:text-xs text-gray-500 truncate",children:V(t)}),e.jsx("span",{className:"text-gray-900 font-medium text-[10px] sm:text-xs md:text-sm",children:n})]}),_e[t._id]&&e.jsxs("div",{className:"mt-2 text-[9px] sm:text-[10px] md:text-xs text-gray-600 space-y-0.5 sm:space-y-1",children:[e.jsxs("div",{className:"truncate",children:["Created: ",new Date(t.createdAt).toLocaleString()]}),e.jsxs("div",{className:"truncate",children:["Invoice:"," ",e.jsx("span",{className:"font-mono",children:V(t)})]}),e.jsxs("div",{className:"truncate",children:["Service Type:"," ",e.jsx("span",{className:"font-semibold text-gray-700",children:t.serviceType==="TAKEAWAY"?"Takeaway":"Dine-In"})]}),t.cancellationReason&&e.jsxs("div",{className:"text-red-600 font-medium bg-red-50 p-1.5 rounded mt-1 border border-red-100",children:["Reason: ",t.cancellationReason]})]})]}),e.jsx("td",{className:"px-2 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-xs sm:text-sm text-gray-600 hidden md:table-cell",children:e.jsxs("div",{className:"flex flex-col gap-0.5",children:[e.jsx("span",{className:"font-medium text-gray-900 text-xs sm:text-sm",children:o}),e.jsx("span",{className:"text-[10px] sm:text-xs text-gray-500",children:n})]})}),e.jsx("td",{className:"px-2 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4",children:e.jsxs("div",{className:"flex items-center gap-1 sm:gap-2",children:[e.jsx("img",{src:Se,alt:"Table",title:"Table",className:"w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 object-contain flex-shrink-0"}),e.jsx("span",{className:"text-xs sm:text-sm md:text-base lg:text-lg font-semibold text-gray-700 truncate",children:t.tableNumber||"N/A"})]})}),e.jsx("td",{className:"px-2 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4",children:e.jsxs("div",{className:"flex flex-col gap-1 sm:gap-1.5 md:gap-2",children:[e.jsxs("span",{className:`px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 inline-flex items-center gap-0.5 sm:gap-1 md:gap-2 text-[9px] sm:text-[10px] md:text-xs lg:text-sm font-medium rounded-full border ${Fe(t.status)}`,children:[e.jsx("span",{className:"text-[10px] sm:text-xs md:text-sm",children:Ne(t.status)}),e.jsx("span",{className:"truncate",children:t.status})]}),e.jsx("div",{className:"flex flex-wrap gap-0.5 sm:gap-1 mt-0.5 sm:mt-1",children:(()=>{const a=gt(t.status,t.serviceType),r=[];return Ae(t.status)&&r.push(e.jsxs("button",{type:"button",onClick:()=>st(t),title:"Accept Order",className:"px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[9px] sm:text-[10px] md:text-xs font-semibold rounded border border-green-200 text-green-700 hover:bg-green-50 bg-green-50 whitespace-nowrap",children:["✅ ",e.jsx("span",{className:"hidden sm:inline",children:"Accept"})]},"accept")),a&&!Ae(t.status)&&r.push(e.jsx("button",{type:"button",onClick:()=>le(t._id,a),title:`Move to ${a}`,className:"px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[9px] sm:text-[10px] md:text-xs font-semibold rounded border border-blue-200 text-blue-700 hover:bg-blue-50 bg-blue-50 truncate max-w-[80px] sm:max-w-none",children:a},"next")),wt(t.status)?r.push(e.jsxs("button",{type:"button",onClick:()=>le(t._id,"Returned"),title:"Return Order",className:"px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[9px] sm:text-[10px] md:text-xs font-semibold rounded border border-rose-200 text-rose-700 hover:bg-rose-50 bg-rose-50 whitespace-nowrap",children:["↩️ ",e.jsx("span",{className:"hidden sm:inline",children:"Return"})]},"return")):yt(t.status)&&r.push(e.jsxs("button",{type:"button",onClick:()=>le(t._id,"Cancelled"),title:"Cancel Order",className:"px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[9px] sm:text-[10px] md:text-xs font-semibold rounded border border-red-200 text-red-700 hover:bg-red-50 whitespace-nowrap",children:["❌ ",e.jsx("span",{className:"hidden sm:inline",children:"Cancel"})]},"cancel")),r})()})]})}),e.jsx("td",{className:"px-2 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-xs sm:text-sm",children:e.jsxs("div",{className:"flex flex-wrap gap-1 sm:gap-1.5 md:gap-2",children:[t.status!=="Paid"&&t.status!=="Cancelled"&&t.status!=="Returned"&&e.jsxs("button",{onClick:()=>Ke(t),className:"px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs md:text-sm text-blue-600 hover:text-blue-900 border border-blue-200 rounded-md hover:bg-blue-50 font-medium whitespace-nowrap",title:"Add more items to this order",children:["➕ ",e.jsx("span",{className:"hidden sm:inline",children:"Modify"})]}),e.jsxs("button",{onClick:()=>Ke(t),className:"px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs md:text-sm text-indigo-600 hover:text-indigo-900 border border-indigo-200 rounded-md hover:bg-indigo-50 whitespace-nowrap",title:"Edit order",children:["✏️ ",e.jsx("span",{className:"hidden sm:inline",children:"Edit"})]}),h?.role!=="admin"&&e.jsxs("button",{type:"button",onClick:a=>nt(a,t._id),className:"px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs md:text-sm text-red-600 hover:text-red-900 border border-red-200 rounded-md hover:bg-red-50 whitespace-nowrap",title:"Delete order",children:["🗑️ ",e.jsx("span",{className:"hidden sm:inline",children:"Delete"})]}),e.jsxs("button",{onClick:()=>St(t),className:"px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs md:text-sm rounded-md border text-gray-700 border-gray-200 hover:bg-gray-100 whitespace-nowrap",title:"Print invoice",children:["🖨️ ",e.jsx("span",{className:"hidden sm:inline",children:"Print"})]})]})})]}),_e[t._id]&&e.jsx("tr",{className:"bg-gray-50",children:e.jsx("td",{colSpan:"5",className:"px-3 sm:px-4 md:px-6 py-3 sm:py-4",children:e.jsx("div",{className:"space-y-3 sm:space-y-4",children:e.jsx("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4",children:Array.isArray(t.kotLines)&&t.kotLines.map((a,r)=>e.jsxs("div",{className:"bg-white p-3 sm:p-4 rounded-lg border shadow-sm",children:[e.jsxs("div",{className:"flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs("div",{className:"text-sm sm:text-base md:text-lg font-semibold text-gray-800",children:["KOT #",r+1]}),e.jsx("button",{type:"button",onClick:i=>{i.stopPropagation(),Be(t,a,r)},className:"p-1 px-2 text-xs text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-100 bg-white",title:"Print KOT",children:"🖨️ Print KOT"})]}),e.jsxs("div",{className:"text-sm sm:text-base md:text-lg font-bold text-green-600",children:["₹",(a.totalAmount||a.total||0).toString()]})]}),e.jsx("div",{className:"space-y-1.5 sm:space-y-2",children:(a.items||[]).map((i,d)=>{if(i.returned)return null;const y=i.convertedToTakeaway===!0;return e.jsxs("div",{className:"flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 py-1 border-b",children:[e.jsxs("div",{className:"flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1",children:[e.jsxs("span",{className:`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-bold whitespace-nowrap flex-shrink-0 ${y?"bg-green-100 text-green-800":"bg-orange-100 text-orange-800"}`,children:[i.quantity,"x"]}),e.jsxs("span",{className:"text-xs sm:text-sm text-gray-800 truncate min-w-0 flex-1",children:[i.name,y&&e.jsx("span",{className:"ml-1 sm:ml-2 text-green-600 font-semibold text-[10px] sm:text-xs whitespace-nowrap",children:"📦 TAKEAWAY"})]})]}),e.jsxs("span",{className:"text-xs sm:text-sm text-gray-600 whitespace-nowrap flex-shrink-0 sm:ml-2",children:["₹",((i.price||0)/100*(i.quantity||1)).toFixed(2)]})]},d)})})]},r))})})})})]},t._id)};b.useEffect(()=>((async()=>{if(c)try{const s=await N.get(`/users/${c}`);v(s.data)}catch{}if(h?.role==="franchise_admin"&&!c)try{const n=((await N.get("/users")).data||[]).filter(a=>{if(a.role!=="admin")return!1;const r=h._id?.toString()||h._id,i=a.franchiseId?a.franchiseId._id?.toString()||a.franchiseId.toString()||a.franchiseId:null;return i&&i.toString()===r.toString()});T(n)}catch{}try{const o=(await N.get("/orders")).data||[];let n=Array.isArray(o)?o.filter(a=>a.serviceType==="DINE_IN"):[];c&&(n=n.filter(a=>{let r=a.cafeId||a.cartId;return r&&typeof r=="object"&&(r=r._id||r),!r&&a.table&&a.table.cafeId&&(r=a.table.cafeId,typeof r=="object"&&(r=r._id||r)),r&&r.toString()===c})),g(n)}catch{}})(),M.on("newOrder",s=>{if(!c)ee(s,{prepend:!0}),U&&ie(s);else{let o=s.cafeId;o&&typeof o=="object"&&(o=o._id||o),o&&o.toString()===c&&(ee(s,{prepend:!0}),U&&ie(s))}}),M.on("orderUpdated",s=>{let o=!0;if(c){let n=s.cafeId;n&&typeof n=="object"&&(n=n._id||n),(!n||n.toString()!==c)&&(o=!1)}o?(g(n=>{const a=n.find(r=>r._id===s._id);return U&&a&&s.kotLines&&a.kotLines&&s.kotLines.length>a.kotLines.length&&ie(s),n}),ee(s)):g(n=>n.filter(a=>a._id!==s._id))}),M.on("orderDeleted",({id:s})=>{g(o=>o.filter(n=>n._id!==s))}),()=>{M.off("newOrder"),M.off("orderUpdated"),M.off("orderDeleted")}),[ee,c,h,U,ie]);const at=()=>{A({isNew:!0}),te(),K.length===0&&!se&&Y(),$(!0)},Ke=t=>{A(t),ye({}),J(""),Z("all"),K.length===0&&Y(),$(!0)},nt=async(t,s)=>{t.preventDefault(),t.stopPropagation();const{confirm:o}=await ot(async()=>{const{confirm:a}=await import("./page-AttendanceManagement.jsx-cGe0zLIE.js").then(r=>r.b);return{confirm:a}},__vite__mapDeps([0,1,2]));if(await o(`Are you sure you want to PERMANENTLY DELETE this order?

This action cannot be undone.`,{title:"Delete Order",warningMessage:"WARNING: PERMANENTLY DELETE",danger:!0,confirmText:"Delete",cancelText:"Cancel"}))try{await N.delete(`/orders/${s}`),g(a=>a.filter(r=>r._id!==s))}catch(a){const r=a.response?.data?.message||a.message||"Failed to delete order";alert(r)}},rt=async t=>{t.preventDefault();const s=t.target;if(m?._id)try{const o=s.status.value;if(o!==m.status){const i=`order-status-${m._id}`;await Ye(i,async d=>await N.patch(`/orders/${m._id}/status`,{status:o},{signal:d}))}if(E.length>0){const i=E.map(d=>({name:d.name,quantity:d.quantity,price:d.price}));await N.post(`/orders/${m._id}/add-items`,{items:i})}const n=await N.get("/orders");let r=(Array.isArray(n.data)?n.data:[]).filter(i=>i.serviceType==="DINE_IN");c&&(r=r.filter(i=>{let d=i.cafeId;return d&&typeof d=="object"&&(d=d._id||d),!d&&i.table&&i.table.cafeId&&(d=i.table.cafeId,typeof d=="object"&&(d=d._id||d)),d&&d.toString()===c})),g(r),$(!1),A(null),te(),alert("Order updated successfully!")}catch(o){const n=o.response?.data?.message||"Failed to update order. Please try again.";alert(n)}},it=async t=>{if(t.preventDefault(),D(""),E.length===0){D("Please add at least one menu item to the order.");return}if(S==="DINE_IN"){if(!re){D("Please select a table for this order.");return}const o=O.find(n=>n._id===re);if(!o){D("Selected table could not be found. Refresh the page and try again.");return}if(o.status!=="AVAILABLE"&&!o.sessionToken){D(`Table ${o.number||o.name||""} is not currently available.`);return}}Me(!0);try{let s=null,o=null,n=null;if(S==="DINE_IN"){if(o=O.find(d=>d._id===re),!o)throw new Error("Selected table could not be found.");if(n=o.number||o.tableNumber,s=o.sessionToken,!s){if(!o.qrSlug)throw new Error("Unable to claim table: missing QR slug.");const d=await fetch(`${Ct}/api/tables/lookup/${o.qrSlug}`),y=await d.json().catch(()=>({}));if(d.status===423)throw new Error(y?.message||"Table is currently assigned to another guest.");if(!d.ok)throw new Error(y?.message||"Failed to allocate table. Please try again.");s=y.sessionToken||y.table?.sessionToken||null}if(!s)throw new Error("Unable to obtain a session token for this table. Ask staff to release the table.")}const a=E.map(d=>({name:d.name,quantity:d.quantity,price:d.price})),r={serviceType:S,tableId:S==="TAKEAWAY"?null:o?._id||null,tableNumber:S==="TAKEAWAY"?"TAKEAWAY":n||null,sessionToken:S==="TAKEAWAY"?void 0:s,items:a},{data:i}=await N.post("/orders",r);i?.serviceType==="DINE_IN"&&g(d=>{const y=Array.isArray(d)?d.filter(P=>P.serviceType==="DINE_IN"):[];return[i,...y]}),$(!1),A(null),te(),oe()}catch(s){D(s.message||"Failed to create order. Please try again.")}finally{Me(!1)}},W=b.useMemo(()=>{if(h?.role!=="franchise_admin"||c)return null;const t={},s=new Set,o=new Map;return I.forEach(n=>{const a=n._id?.toString()||n._id;a&&(o.set(a,n),t[a]={cart:n,orders:[]})}),Object.entries(_).forEach(([n,a])=>{o.has(n)||(o.set(n,a),t[n]={cart:a,orders:[]})}),u.forEach(n=>{const a=n._id?.toString()||n._id;if(!a||s.has(a))return;let r=n.cafeId||n.cartId;r&&typeof r=="object"&&(r=r._id||r),!r&&n.table&&n.table.cafeId&&(r=n.table.cafeId,typeof r=="object"&&(r=r._id||r));const i=r?.toString();if(i&&o.has(i))t[i].orders.push(n),s.add(a);else if(i)if(_[i])t[i]||(t[i]={cart:_[i],orders:[]}),t[i].orders.push(n),s.add(a);else{const d=n.cart||n.cafe||null;t[i]={cart:d||{_id:i,name:"Loading...",cartName:"Loading...",cartCode:""},orders:[n]},s.add(a)}}),t},[u,I,_,h,c]);b.useEffect(()=>{if(h?.role!=="franchise_admin"||c||!W)return;(async()=>{const s=[];if(Object.entries(W).forEach(([n,{cart:a}])=>{(a.cartName==="Loading..."||a.cartName==="Unknown Cart")&&!_[n]&&s.push(n)}),s.length===0)return;const o=(Array.isArray(s)?s:[]).map(async n=>{if(!n)return null;try{const a=await N.get(`/users/${n}`);if(a.data){const r={_id:n,name:a.data.cartName||a.data.name||"Unknown Cart",cartName:a.data.cartName||a.data.name||"Unknown Cart",cartCode:a.data.cartCode||""};return F(i=>({...i,[n]:r})),{cartId:n,cartInfo:r}}}catch{F(r=>({...r,[n]:{_id:n,name:"Unknown Cart",cartName:"Unknown Cart",cartCode:""}}))}});await Promise.all(o)})()},[W,h,c]);const Ue=(()=>{const t=R.trim().toLowerCase(),s=xe.trim().toLowerCase(),o=pe.trim().toLowerCase(),n=u.filter(i=>i.serviceType==="DINE_IN"),a=new Map;n.forEach(i=>{const d=i._id?.toString()||i._id;d&&!a.has(d)&&a.set(d,i)});const r=Array.from(a.values()).filter(i=>{const d=!t||(i._id||"").toLowerCase().includes(t),y=!s||i.tableNumber!==void 0&&i.tableNumber!==null&&String(i.tableNumber).toLowerCase().includes(s),P=V(i).toLowerCase(),k=!o||P.includes(o);let w=!0;if(G){const x=new Date(i.createdAt),je=new Date(G),Ie=x.toISOString().split("T")[0],Ce=je.toISOString().split("T")[0];w=Ie===Ce}return d&&y&&k&&w});return q==="all"?r:r.filter(i=>i.status===q)})(),We=t=>{const s=R.trim().toLowerCase(),o=xe.trim().toLowerCase(),n=pe.trim().toLowerCase(),a=new Map;t.forEach(i=>{const d=i._id?.toString()||i._id;d&&!a.has(d)&&a.set(d,i)});const r=Array.from(a.values()).filter(i=>{const d=!s||(i._id||"").toLowerCase().includes(s),y=!o||i.tableNumber!==void 0&&i.tableNumber!==null&&String(i.tableNumber).toLowerCase().includes(o),P=V(i).toLowerCase(),k=!n||P.includes(n);let w=!0;if(G){const x=new Date(i.createdAt),je=new Date(G),Ie=x.toISOString().split("T")[0],Ce=je.toISOString().split("T")[0];w=Ie===Ce}return d&&y&&k&&w});return q==="all"?r:r.filter(i=>i.status===q)},lt=t=>{z(s=>({...s,[t]:!s[t]}))},Y=b.useCallback(async()=>{try{Oe(!0),ue("");const s=(await N.get("/menu")).data||[];if(!Array.isArray(s)||s.length===0){ue("No menu items found. Please add menu items first."),he([{id:"all",label:"All"}]),be([]);return}const o=s.map(r=>({name:r.name||"Menu",items:(r.items||[]).map(i=>({id:i._id||`${r.name||"Menu"}-${i.name||Math.random()}`,name:i.name||"Unnamed Item",price:Number(i.price)||0,description:i.description||"",category:r.name||"Menu",image:i.image||""}))})),n=[{id:"all",label:"All"},...o.map(r=>({id:r.name,label:r.name}))];he(n);const a=o.flatMap(r=>r.items.map(i=>({...i,category:r.name})));be(a)}catch(t){const s=t.response?.data?.message||t.message||"Failed to load menu";ue(s),he([{id:"all",label:"All"}]),be([])}finally{Oe(!1)}},[]),oe=b.useCallback(async()=>{try{Re(!0);let s=(await N.get("/tables")).data;s&&s.success&&Array.isArray(s.data)?s=s.data:Array.isArray(s)||(s=[]);const o=s.sort((n,a)=>{const r=Number(n.number),i=Number(a.number);return Number.isFinite(r)&&Number.isFinite(i)?r-i:String(n.name||"").localeCompare(String(a.name||""))});Pe(o)}catch{Pe([])}finally{Re(!1)}},[]);b.useEffect(()=>{Y(),oe()},[Y,oe]);const B=t=>t.id||t._id||t.name,E=b.useMemo(()=>Object.values(ae).map(({item:t,quantity:s})=>({id:B(t),name:t.name,quantity:s,price:Number(t.price)||0,item:t})),[ae]),L=b.useMemo(()=>{const t=E.reduce((a,r)=>a+r.price*r.quantity,0),s=t*.05,o=t+s,n=E.reduce((a,r)=>a+r.quantity,0);return{subtotal:t,gst:s,total:o,totalItems:n}},[E]),de=b.useMemo(()=>{const t=ne.trim().toLowerCase();return K.filter(s=>{const o=X==="all"||s.category===X,n=!t||s.name.toLowerCase().includes(t)||s.description.toLowerCase().includes(t);return o&&n})},[K,X,ne]),ce=b.useCallback((t,s)=>{ye(o=>{const n=B(t),a={...o},i=(a[n]||{quantity:0}).quantity+s;return i<=0?delete a[n]:a[n]={item:t,quantity:i},a})},[]),{tablesForService:ve}=b.useMemo(()=>{if(S==="DINE_IN")return{tablesForService:O.filter(o=>(o.status||"UNKNOWN")==="AVAILABLE"||!!o.sessionToken),usingFallbackTables:!1};const t=O.filter(s=>{const o=`${s.name||""} ${s.number||""}`.toLowerCase();return o.includes("takeaway")||o.includes("counter")});return t.length>0?{tablesForService:t,usingFallbackTables:!1}:{tablesForService:O,usingFallbackTables:!0}},[O,S]),te=b.useCallback(()=>{ye({}),J(""),Z("all"),we(""),De("DINE_IN"),D("")},[]);return e.jsxs("div",{className:"p-4 md:p-6",children:[e.jsxs("div",{className:"mb-6",children:[e.jsxs("div",{className:"flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4",children:[e.jsxs("div",{className:"min-w-0 flex-1",children:[e.jsx("h1",{className:"text-2xl font-bold text-gray-900",children:c&&f?`Orders - ${f.cafeName||f.name}`:"Orders"}),c&&e.jsx("p",{className:"text-sm text-gray-500 mt-1",children:"Filtered by specific cart"})]}),c&&e.jsx("button",{onClick:()=>window.location.href="/orders",className:"px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm whitespace-nowrap",children:"View All Carts"}),e.jsx("div",{className:"flex items-center gap-2",children:e.jsxs("label",{className:"flex items-center gap-2 cursor-pointer select-none bg-white px-3 py-2 rounded-lg border border-gray-300 shadow-sm",children:[e.jsxs("div",{className:"relative",children:[e.jsx("input",{type:"checkbox",className:"peer sr-only",checked:U,onChange:et}),e.jsx("div",{className:"w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"})]}),e.jsx("span",{className:"text-sm font-medium text-gray-700",children:U?"🖨️ Auto-Print ON":"🖨️ Auto-Print OFF"})]})})]}),e.jsxs("div",{className:"grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3",children:[e.jsx("input",{type:"text",placeholder:"Order ID / Token",value:R,onChange:t=>Q(t.target.value),className:"border border-gray-300 rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"}),e.jsx("input",{type:"text",placeholder:"Table number",value:xe,onChange:t=>Ge(t.target.value),className:"border border-gray-300 rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"}),e.jsx("input",{type:"text",placeholder:"Invoice ID",value:pe,onChange:t=>He(t.target.value),className:"border border-gray-300 rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"}),e.jsx("input",{type:"date",value:G,onChange:t=>Je(t.target.value),className:"border border-gray-300 rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",title:"Filter by order date"}),h?.role!=="franchise_admin"&&e.jsxs("button",{onClick:at,className:"bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow-sm text-sm flex items-center justify-center gap-2 transition-colors",children:[e.jsx("span",{className:"text-lg",children:"+"}),"Add Order"]})]})]}),e.jsxs("div",{className:"grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6",children:[e.jsxs("button",{type:"button",onClick:()=>$e("all"),className:`bg-white rounded-lg border-2 p-4 text-left transition-all hover:shadow-md ${q==="all"?"border-blue-500 shadow-md":"border-gray-200"}`,children:[e.jsxs("div",{className:"flex items-center justify-between mb-2",children:[e.jsx("div",{className:"text-3xl font-bold text-gray-900",children:u.filter(t=>t.serviceType==="DINE_IN").length}),e.jsx("div",{className:"w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-xl",children:"📦"})]}),e.jsx("div",{className:"text-sm text-gray-600 font-medium",children:"All Dine-In"})]}),Object.entries(u.filter(t=>t.serviceType==="DINE_IN").reduce((t,s)=>(t[s.status]=(t[s.status]||0)+1,t),{})).map(([t,s])=>e.jsxs("button",{type:"button",onClick:()=>$e(t),className:`bg-white rounded-lg border-2 p-4 text-left transition-all hover:shadow-md ${q===t?"border-blue-500 shadow-md":"border-gray-200"} ${Fe(t)}`,children:[e.jsxs("div",{className:"flex items-center justify-between mb-2",children:[e.jsx("div",{className:"text-3xl font-bold text-gray-900",children:s}),e.jsx("div",{className:"w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-xl",children:Ne(t)})]}),e.jsx("div",{className:"text-sm text-gray-600 font-medium",children:t})]},t))]}),e.jsx("div",{className:"overflow-x-auto bg-white rounded-lg shadow-md -mx-2 sm:mx-0",children:h?.role==="franchise_admin"&&!c&&W?e.jsxs("div",{className:"divide-y divide-gray-200",children:[Object.entries(W).filter(([,{orders:t}])=>We(t).length>0).map(([t,{cart:s,orders:o}])=>{const n=We(o),a=s.cartName||s.name||s.cafeName||"Unknown Cart",r=s.cartCode||"",i=C[t]!==!1;return e.jsxs("div",{className:"border-b border-gray-300",children:[e.jsxs("div",{className:"bg-gray-100 hover:bg-gray-200 cursor-pointer px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3",onClick:()=>lt(t),children:[e.jsxs("div",{className:"flex items-center gap-2 sm:gap-3 min-w-0 flex-1",children:[e.jsx("span",{className:"text-base sm:text-lg flex-shrink-0",children:i?"▼":"▶"}),r&&e.jsx("span",{className:"px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-mono font-bold bg-gradient-to-r from-[#d86d2a] to-[#c75b1a] text-white rounded whitespace-nowrap flex-shrink-0",children:r}),e.jsx("h3",{className:"text-sm sm:text-base md:text-lg font-bold text-gray-800 truncate min-w-0 flex-1",children:a}),e.jsxs("span",{className:"text-xs sm:text-sm text-gray-600 whitespace-nowrap flex-shrink-0",children:["(",n.length," orders)"]})]}),e.jsx("button",{onClick:d=>{d.stopPropagation(),p(`/orders?cafeId=${t}`)},className:"px-2 sm:px-3 py-1 text-xs sm:text-sm bg-blue-500 text-white rounded hover:bg-blue-600 whitespace-nowrap flex-shrink-0",children:"View All"})]}),i&&e.jsx("div",{className:"overflow-x-auto",children:e.jsxs("table",{className:"min-w-full text-xs sm:text-sm",children:[e.jsx("thead",{className:"bg-gray-50",children:e.jsxs("tr",{children:[e.jsx("th",{className:"px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase",children:"Order Details"}),e.jsx("th",{className:"px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden md:table-cell",children:"Date & Time"}),e.jsx("th",{className:"px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase",children:"Table"}),e.jsx("th",{className:"px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase",children:"Status"}),e.jsx("th",{className:"px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase",children:"Actions"})]})}),e.jsx("tbody",{className:"divide-y divide-gray-200",children:n.map(d=>qe(d))})]})})]},t)}),Object.keys(W).length===0&&e.jsx("div",{className:"px-6 py-8 text-center text-gray-500",children:"No orders found for any cart."})]}):e.jsx("div",{className:"overflow-x-auto",children:e.jsxs("table",{className:"min-w-full text-xs sm:text-sm",children:[e.jsx("thead",{className:"bg-gray-50",children:e.jsxs("tr",{children:[e.jsx("th",{className:"px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase",children:"Order Details"}),e.jsx("th",{className:"px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden md:table-cell",children:"Date & Time"}),e.jsx("th",{className:"px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase",children:"Table"}),e.jsx("th",{className:"px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase",children:"Status"}),e.jsx("th",{className:"px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase",children:"Actions"})]})}),e.jsxs("tbody",{className:"divide-y divide-gray-200",children:[Ue.length===0&&e.jsx("tr",{children:e.jsx("td",{colSpan:"5",className:"px-3 sm:px-4 md:px-6 py-4 text-center text-gray-500 text-xs sm:text-sm",children:"No orders found."})}),Ue.map(t=>qe(t))]})]})})}),Ee&&e.jsx("div",{className:"fixed inset-0 bg-slate-900/30 backdrop-blur-sm overflow-y-auto h-full w-full flex items-center justify-center z-[9999] p-2 sm:p-3 md:p-4 lg:p-6",children:e.jsxs("div",{className:"bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col my-auto",children:[e.jsxs("div",{className:"flex justify-between items-center p-3 sm:p-4 md:p-6 border-b border-gray-200 sticky top-0 bg-white z-10 flex-shrink-0",children:[e.jsx("h2",{className:"text-lg sm:text-xl md:text-2xl font-bold text-gray-800 truncate",children:m?.isNew?"Add Order":"Edit Order"}),e.jsx("button",{onClick:()=>{$(!1),A(null),te()},className:"text-gray-400 hover:text-gray-600 text-xl sm:text-2xl leading-none p-1 ml-2 flex-shrink-0","aria-label":"Close modal",children:"×"})]}),e.jsx("div",{className:"overflow-y-auto flex-1 p-3 sm:p-4 md:p-6",children:e.jsx("form",{id:"order-form",onSubmit:m?.isNew?it:rt,className:"space-y-6",children:m?.isNew?e.jsxs("div",{className:"space-y-6",children:[ze&&e.jsx("div",{className:"rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",children:ze}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx("label",{className:"block text-gray-700 text-sm font-semibold mb-2",children:"Service Type"}),e.jsx("div",{className:"flex items-center gap-2",children:["DINE_IN","TAKEAWAY"].map(t=>e.jsx("button",{type:"button",onClick:()=>{if(De(t),we(""),t==="DINE_IN")try{M.emit("dine",{timestamp:new Date().toISOString(),serviceType:"DINE_IN"})}catch{}},className:`px-3 py-1.5 rounded-lg border text-sm font-medium ${S===t?"bg-blue-600 text-white border-blue-600 shadow":"border-gray-300 text-gray-600 hover:border-blue-400"}`,children:t==="DINE_IN"?"Dine-In":"Takeaway"},t))}),S==="TAKEAWAY"&&e.jsx("p",{className:"text-xs text-gray-500 mt-2",children:"Counter takeaway order - no table selection needed."})]}),S==="DINE_IN"&&e.jsxs("div",{children:[e.jsxs("label",{className:"block text-gray-700 text-sm font-semibold mb-2 flex items-center gap-2",children:[e.jsx("img",{src:Se,alt:"Table",className:"w-5 h-5 object-contain"}),"Choose Table"]}),e.jsxs("div",{className:"flex flex-col md:flex-row md:items-center gap-3",children:[e.jsxs("select",{value:re,onChange:t=>we(t.target.value),className:"shadow-sm border border-gray-300 rounded-lg w-full md:w-72 py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent",children:[e.jsx("option",{value:"",children:"Select a table"}),ve.length===0?e.jsx("option",{value:"",disabled:!0,children:"No available tables found"}):ve.map(t=>{const s=t.number?`Table ${t.number}`:t.name||"Unnamed",o=t.status||"UNKNOWN",n=o==="AVAILABLE"||!!t.sessionToken;return e.jsxs("option",{value:t._id,disabled:!n,children:[s," · ",o.toLowerCase(),n?"":" (locked)"]},t._id)})]}),e.jsx("button",{type:"button",onClick:oe,className:"text-sm text-blue-600 hover:text-blue-800 whitespace-nowrap",children:"🔄 Refresh tables"})]}),ge&&e.jsx("p",{className:"text-xs text-gray-500 mt-1",children:"Loading tables…"}),!ge&&ve.length===0&&O.length>0&&e.jsx("p",{className:"text-xs text-yellow-600 mt-1",children:"⚠️ No available tables found. All tables may be occupied."}),!ge&&O.length===0&&e.jsx("p",{className:"text-xs text-red-600 mt-1",children:"⚠️ No tables found. Please add tables first or refresh."})]})]}),e.jsxs("div",{className:"grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4 md:gap-5",children:[e.jsxs("div",{className:"xl:col-span-2 space-y-3 sm:space-y-4",children:[e.jsxs("div",{className:"flex flex-col lg:flex-row lg:items-center gap-2 sm:gap-3",children:[e.jsx("input",{type:"text",value:ne,onChange:t=>J(t.target.value),placeholder:"Search menu items...",className:"flex-1 shadow-sm border border-gray-300 rounded-lg py-1.5 sm:py-2 px-2 sm:px-3 text-xs sm:text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"}),e.jsx("div",{className:"flex flex-wrap gap-1.5 sm:gap-2",children:fe.map(t=>e.jsx("button",{type:"button",onClick:()=>Z(t.id),className:`px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm rounded-full border transition whitespace-nowrap ${X===t.id?"bg-blue-600 text-white border-blue-600 shadow":"border-gray-300 text-gray-600 hover:border-blue-400"}`,children:t.label},t.id))})]}),e.jsx("div",{className:"border border-gray-200 rounded-lg max-h-60 sm:max-h-80 overflow-y-auto divide-y",children:se?e.jsx("div",{className:"p-4 text-sm text-gray-500",children:"Loading menu…"}):H?e.jsx("div",{className:"p-4 text-sm text-red-600",children:H}):de.length===0?e.jsx("div",{className:"p-4 text-sm text-gray-500",children:"No menu items match your filters."}):de.map(t=>{const s=ae[B(t)]?.quantity||0;return e.jsxs("div",{className:"flex items-center justify-between gap-2 sm:gap-3 md:gap-4 px-2 sm:px-3 md:px-4 py-2 sm:py-3 hover:bg-gray-50",children:[e.jsxs("div",{className:"min-w-0 flex-1",children:[e.jsx("div",{className:"text-xs sm:text-sm font-semibold text-gray-800 truncate",children:t.name}),e.jsxs("div",{className:"text-[10px] sm:text-xs text-gray-500 truncate",children:["₹",j(t.price)," ·"," ",t.category]})]}),e.jsxs("div",{className:"flex items-center gap-1.5 sm:gap-2 flex-shrink-0",children:[e.jsx("button",{type:"button",onClick:()=>ce(t,-1),disabled:s===0,className:"w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm",children:"-"}),e.jsx("span",{className:"w-6 sm:w-7 md:w-8 text-center text-xs sm:text-sm font-semibold text-gray-700",children:s}),e.jsx("button",{type:"button",onClick:()=>ce(t,1),className:"w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full border border-blue-500 text-blue-600 hover:bg-blue-50 text-xs sm:text-sm",children:"+"})]})]},B(t))})})]}),e.jsx("div",{className:"space-y-3 sm:space-y-4",children:e.jsxs("div",{className:"bg-slate-50 border border-slate-200 rounded-lg p-3 sm:p-4",children:[e.jsx("h3",{className:"text-base sm:text-lg font-semibold text-gray-800 mb-2 sm:mb-3",children:"Order Summary"}),e.jsxs("div",{className:"flex items-center justify-between text-xs text-gray-500 mb-3",children:[e.jsx("span",{children:"Service Type"}),e.jsx("span",{className:"font-semibold text-gray-700",children:S==="TAKEAWAY"?"Takeaway":"Dine-In"})]}),E.length===0?e.jsx("p",{className:"text-sm text-gray-500",children:"No items selected yet. Use the menu on the left to build the order."}):e.jsx("div",{className:"space-y-2 text-sm text-gray-700",children:E.map(t=>e.jsxs("div",{className:"flex justify-between items-center",children:[e.jsxs("span",{children:[t.name," × ",t.quantity]}),e.jsxs("span",{children:["₹",j(t.price*t.quantity)]})]},t.id))}),e.jsxs("div",{className:"mt-4 space-y-1 text-sm text-gray-600",children:[e.jsxs("div",{className:"flex justify-between",children:[e.jsx("span",{children:"Items"}),e.jsx("span",{children:L.totalItems})]}),e.jsxs("div",{className:"flex justify-between",children:[e.jsx("span",{children:"Subtotal"}),e.jsxs("span",{children:["₹",j(L.subtotal)]})]}),e.jsxs("div",{className:"flex justify-between",children:[e.jsx("span",{children:"GST (5%)"}),e.jsxs("span",{children:["₹",j(L.gst)]})]}),e.jsxs("div",{className:"flex justify-between font-semibold text-gray-800 pt-2 border-t border-gray-200",children:[e.jsx("span",{children:"Total"}),e.jsxs("span",{children:["₹",j(L.total)]})]})]})]})})]})]}):e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4",children:[e.jsxs("div",{children:[e.jsxs("label",{htmlFor:"tableNumber",className:"block text-gray-700 text-xs sm:text-sm font-bold mb-1 sm:mb-2 flex items-center gap-1.5 sm:gap-2",children:[e.jsx("img",{src:Se,alt:"Table",className:"w-4 h-4 sm:w-5 sm:h-5 object-contain"}),"Table Number"]}),e.jsx("input",{type:"text",id:"tableNumber",name:"tableNumber",defaultValue:m?.tableNumber||"",className:"shadow-sm border border-gray-300 rounded-lg w-full py-1.5 sm:py-2 px-2 sm:px-3 text-xs sm:text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent",readOnly:!0})]}),e.jsxs("div",{children:[e.jsxs("label",{htmlFor:"status",className:"block text-gray-700 text-xs sm:text-sm font-bold mb-1 sm:mb-2",children:["Order Status"," ",Ne(m?.status||"Pending")]}),e.jsxs("select",{id:"status",name:"status",defaultValue:m?.status||"Pending",className:"shadow-sm border border-gray-300 rounded-lg w-full py-1.5 sm:py-2 px-2 sm:px-3 text-xs sm:text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent",children:[e.jsx("option",{value:"Pending",children:"⏳ Pending"}),e.jsx("option",{value:"Confirmed",children:"👨‍🍳 Confirmed"}),e.jsx("option",{value:"Preparing",children:"🔥 Preparing"}),e.jsx("option",{value:"Ready",children:"🍽️ Ready"}),e.jsx("option",{value:"Served",children:"🤝 Served"}),e.jsx("option",{value:"Paid",children:"✅ Paid"}),e.jsx("option",{value:"Cancelled",children:"❌ Cancelled"}),e.jsx("option",{value:"Returned",children:"↩️ Returned"})]})]})]}),m?.cancellationReason&&e.jsxs("div",{className:"bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4",children:[e.jsxs("h4",{className:"text-sm font-bold text-red-800 mb-1",children:["Reason for ",m.status==="Returned"?"Return":"Cancellation",":"]}),e.jsx("p",{className:"text-sm text-red-700",children:m.cancellationReason})]}),m&&!m.isNew&&e.jsxs("div",{className:"border-t pt-4 sm:pt-6",children:[e.jsx("h3",{className:"text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4",children:"Current Order Items"}),(()=>{const t=[];if((Array.isArray(m.kotLines)?m.kotLines:[]).forEach((a,r)=>{(Array.isArray(a.items)?a.items:[]).forEach((d,y)=>{d.returned||t.push({kotIndex:r,itemIndex:y,name:d.name||"Item",quantity:d.quantity||1,price:Qe(d.price||0),isTakeaway:d.convertedToTakeaway===!0,item:d})})}),t.length===0)return e.jsx("div",{className:"bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-500",children:"No active items in this order."});const o=m.status==="Paid",n=!["Cancelled","Returned"].includes(m.status||"");return e.jsxs("div",{className:"bg-white border border-gray-200 rounded-lg overflow-hidden",children:[e.jsx("div",{className:"overflow-x-auto -mx-3 sm:mx-0",children:e.jsx("div",{className:"inline-block min-w-full align-middle",children:e.jsxs("table",{className:"min-w-full divide-y divide-gray-200",children:[e.jsx("thead",{className:"bg-gray-50",children:e.jsxs("tr",{children:[e.jsx("th",{className:"px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase",children:"Item"}),e.jsx("th",{className:"px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase",children:"Qty"}),e.jsx("th",{className:"px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase",children:"Price"}),e.jsx("th",{className:"px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase",children:"Total"}),e.jsx("th",{className:"px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase",children:"Action"})]})}),e.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:t.map((a,r)=>e.jsxs("tr",{className:`hover:bg-gray-50 ${a.isTakeaway?"bg-green-50":""}`,children:[e.jsxs("td",{className:"px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-800 min-w-[120px]",children:[e.jsx("span",{className:"truncate block",children:a.name}),a.isTakeaway&&e.jsx("span",{className:"ml-1 sm:ml-2 text-green-600 font-semibold text-[10px] sm:text-xs whitespace-nowrap",children:"📦 TAKEAWAY"})]}),e.jsx("td",{className:"px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 whitespace-nowrap",children:a.quantity}),e.jsxs("td",{className:"px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 whitespace-nowrap",children:["₹",j(a.price)]}),e.jsxs("td",{className:"px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-gray-800 whitespace-nowrap",children:["₹",j(a.price*a.quantity)]}),e.jsxs("td",{className:"px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm",children:[n&&e.jsx("div",{className:"flex flex-wrap gap-1 sm:gap-2",children:o?e.jsxs("button",{type:"button",onClick:async()=>{if(await window.confirm(`Convert ${a.quantity}x ${a.name} to takeaway?`))try{await N.patch(`/orders/${m._id}/convert-to-takeaway`,{itemIds:[{kotIndex:a.kotIndex,itemIndex:a.itemIndex}]}),alert("Item converted to takeaway successfully!");const d=await N.get(`/orders/${m._id}`);A(d.data);const y=await N.get("/orders");let k=(Array.isArray(y.data)?y.data:[]).filter(w=>w.serviceType==="DINE_IN");c&&(k=k.filter(w=>{let x=w.cafeId;return x&&typeof x=="object"&&(x=x._id||x),!x&&w.table&&w.table.cafeId&&(x=w.table.cafeId,typeof x=="object"&&(x=x._id||x)),x&&x.toString()===c})),g(k)}catch(d){console.error("Failed to convert item to takeaway:",d);const y=d.response?.data?.message||"Failed to convert item to takeaway. Please try again.";alert(y)}},className:"px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs bg-green-100 text-green-700 border border-green-300 rounded hover:bg-green-200 font-medium whitespace-nowrap",children:["📦"," ",e.jsx("span",{className:"hidden sm:inline",children:"Takeaway"})]}):e.jsxs(e.Fragment,{children:[e.jsxs("button",{type:"button",onClick:async()=>{if(await window.confirm(`Cancel ${a.quantity}x ${a.name}?`))try{await N.patch(`/orders/${m._id}/return-items`,{itemIds:[{kotIndex:a.kotIndex,itemIndex:a.itemIndex}]}),alert("Item cancelled successfully!");const d=await N.get(`/orders/${m._id}`);A(d.data);const y=await N.get("/orders");let k=(Array.isArray(y.data)?y.data:[]).filter(w=>w.serviceType==="DINE_IN");c&&(k=k.filter(w=>{let x=w.cafeId;return x&&typeof x=="object"&&(x=x._id||x),!x&&w.table&&w.table.cafeId&&(x=w.table.cafeId,typeof x=="object"&&(x=x._id||x)),x&&x.toString()===c})),g(k)}catch(d){const y=d.response?.data?.message||"Failed to cancel item. Please try again.";alert(y)}},className:"px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs bg-red-100 text-red-700 border border-red-300 rounded hover:bg-red-200 font-medium whitespace-nowrap",children:["❌"," ",e.jsx("span",{className:"hidden sm:inline",children:"Cancel"})]}),e.jsxs("button",{type:"button",onClick:async()=>{if(await window.confirm(`Convert ${a.quantity}x ${a.name} to takeaway?`))try{await N.patch(`/orders/${m._id}/convert-to-takeaway`,{itemIds:[{kotIndex:a.kotIndex,itemIndex:a.itemIndex}]}),alert("Item marked as takeaway in bill. Order remains as dine-in.");const d=await N.get(`/orders/${m._id}`);A(d.data);const y=await N.get("/orders");let k=(Array.isArray(y.data)?y.data:[]).filter(w=>w.serviceType==="DINE_IN");c&&(k=k.filter(w=>{let x=w.cafeId;return x&&typeof x=="object"&&(x=x._id||x),!x&&w.table&&w.table.cafeId&&(x=w.table.cafeId,typeof x=="object"&&(x=x._id||x)),x&&x.toString()===c})),g(k)}catch(d){const y=d.response?.data?.message||"Failed to convert item to takeaway. Please try again.";alert(y)}},className:"px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs bg-green-100 text-green-700 border border-green-300 rounded hover:bg-green-200 font-medium whitespace-nowrap",children:["📦"," ",e.jsx("span",{className:"hidden sm:inline",children:"Takeaway"})]})]})}),!n&&e.jsx("span",{className:"text-xs text-gray-400 italic",children:m.status==="Cancelled"?"Cancelled":m.status==="Returned"?"Returned":"N/A"})]})]},`${a.kotIndex}-${a.itemIndex}-${r}`))})]})})}),e.jsx("div",{className:"bg-gray-50 px-3 sm:px-4 py-2 sm:py-3 border-t border-gray-200",children:e.jsx("p",{className:"text-xs text-gray-600",children:o?e.jsxs(e.Fragment,{children:["💡 ",e.jsx("strong",{children:"After Payment:"})," You can convert remaining items to takeaway for customers to carry home."]}):e.jsxs(e.Fragment,{children:["💡 ",e.jsx("strong",{children:"Before Payment:"})," You can cancel individual items or convert them to takeaway from this order."]})})})]})})()]}),e.jsxs("div",{className:"border-t pt-4 sm:pt-6",children:[e.jsx("h3",{className:"text-base sm:text-lg font-semibold text-gray-800 mb-2 sm:mb-3",children:"Add Items to Order"}),m?.status==="Paid"?e.jsx("div",{className:"mb-4 p-3 bg-red-50 border border-red-200 rounded-lg",children:e.jsx("p",{className:"text-sm text-red-800",children:"⚠️ This order has been paid. Items cannot be added to paid orders. Please create a new order instead."})}):m?.status==="Cancelled"||m?.status==="Returned"?e.jsx("div",{className:"mb-4 p-3 bg-red-50 border border-red-200 rounded-lg",children:e.jsxs("p",{className:"text-sm text-red-800",children:["⚠️ This order is ",m.status.toLowerCase(),". Items cannot be added."]})}):e.jsx("p",{className:"text-sm text-gray-600 mb-4",children:"You can add more items to this order until payment is completed. Selected items will be added as a new KOT."}),K.length===0&&!se&&!H&&e.jsx("div",{className:"mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg",children:e.jsxs("p",{className:"text-sm text-yellow-800",children:["Menu not loaded."," ",e.jsx("button",{type:"button",onClick:Y,className:"text-blue-600 hover:text-blue-800 underline",children:"Click here to load menu"})]})}),e.jsxs("div",{className:"grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4 md:gap-5",children:[e.jsxs("div",{className:"xl:col-span-2 space-y-3 sm:space-y-4",children:[e.jsxs("div",{className:"flex flex-col lg:flex-row lg:items-center gap-2 sm:gap-3",children:[e.jsx("input",{type:"text",value:ne,onChange:t=>J(t.target.value),placeholder:"Search menu items...",className:"flex-1 shadow-sm border border-gray-300 rounded-lg py-1.5 sm:py-2 px-2 sm:px-3 text-xs sm:text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"}),e.jsx("div",{className:"flex flex-wrap gap-1.5 sm:gap-2",children:fe.length>0?fe.map(t=>e.jsx("button",{type:"button",onClick:()=>Z(t.id),className:`px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm rounded-full border transition whitespace-nowrap ${X===t.id?"bg-blue-600 text-white border-blue-600 shadow":"border-gray-300 text-gray-600 hover:border-blue-400"}`,children:t.label},t.id)):e.jsx("span",{className:"text-[10px] sm:text-xs text-gray-500 px-2",children:"No categories available"})})]}),e.jsx("div",{className:"border border-gray-200 rounded-lg max-h-60 sm:max-h-80 overflow-y-auto divide-y",children:se?e.jsx("div",{className:"p-4 text-sm text-gray-500",children:"Loading menu…"}):H?e.jsxs("div",{className:"p-4 text-sm text-red-600",children:[H,e.jsx("button",{type:"button",onClick:Y,className:"ml-2 text-blue-600 hover:text-blue-800 underline",children:"Retry"})]}):K.length===0?e.jsx("div",{className:"p-4 text-sm text-gray-500",children:"No menu items available. Please add items to the menu first."}):de.length===0?e.jsxs("div",{className:"p-4 text-sm text-gray-500",children:["No menu items match your filters. Try changing the search or category.",e.jsx("button",{type:"button",onClick:()=>{J(""),Z("all")},className:"ml-2 text-blue-600 hover:text-blue-800 underline",children:"Clear filters"})]}):de.map(t=>{const s=ae[B(t)]?.quantity||0;return e.jsxs("div",{className:"flex items-center justify-between gap-2 sm:gap-3 md:gap-4 px-2 sm:px-3 md:px-4 py-2 sm:py-3 hover:bg-gray-50",children:[e.jsxs("div",{className:"min-w-0 flex-1",children:[e.jsx("div",{className:"text-xs sm:text-sm font-semibold text-gray-800 truncate",children:t.name}),e.jsxs("div",{className:"text-[10px] sm:text-xs text-gray-500 truncate",children:["₹",j(t.price)," ·"," ",t.category]})]}),e.jsxs("div",{className:"flex items-center gap-1.5 sm:gap-2 flex-shrink-0",children:[e.jsx("button",{type:"button",onClick:()=>ce(t,-1),disabled:s===0||m?.status==="Paid"||m?.status==="Cancelled"||m?.status==="Returned",className:"w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm",children:"-"}),e.jsx("span",{className:"w-6 sm:w-7 md:w-8 text-center text-xs sm:text-sm font-semibold text-gray-700",children:s}),e.jsx("button",{type:"button",onClick:()=>ce(t,1),disabled:m?.status==="Paid"||m?.status==="Cancelled"||m?.status==="Returned",className:"w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full border border-blue-500 text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm",children:"+"})]})]},B(t))})})]}),e.jsx("div",{className:"space-y-3 sm:space-y-4",children:e.jsxs("div",{className:"bg-slate-50 border border-slate-200 rounded-lg p-3 sm:p-4",children:[e.jsx("h3",{className:"text-base sm:text-lg font-semibold text-gray-800 mb-2 sm:mb-3",children:"New Items Summary"}),m?.status==="Paid"||m?.status==="Cancelled"||m?.status==="Returned"?e.jsxs("p",{className:"text-xs sm:text-sm text-red-600 font-medium",children:["⚠️ Cannot add items to"," ",m?.status.toLowerCase()," orders. Items can only be added to unpaid orders."]}):E.length===0?e.jsx("p",{className:"text-xs sm:text-sm text-gray-500",children:"No new items selected. Select items from the menu to add them to this order."}):e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-gray-700 mb-3 sm:mb-4",children:E.map(t=>e.jsxs("div",{className:"flex justify-between items-center gap-2",children:[e.jsxs("span",{className:"truncate min-w-0 flex-1",children:[t.name," × ",t.quantity]}),e.jsxs("span",{className:"whitespace-nowrap flex-shrink-0",children:["₹",j(t.price*t.quantity)]})]},t.id))}),e.jsxs("div",{className:"mt-3 sm:mt-4 space-y-1 text-xs sm:text-sm text-gray-600 border-t border-gray-300 pt-2 sm:pt-3",children:[e.jsxs("div",{className:"flex justify-between",children:[e.jsx("span",{children:"Subtotal"}),e.jsxs("span",{children:["₹",j(L.subtotal)]})]}),e.jsxs("div",{className:"flex justify-between",children:[e.jsx("span",{children:"GST (5%)"}),e.jsxs("span",{children:["₹",j(L.gst)]})]}),e.jsxs("div",{className:"flex justify-between font-semibold text-gray-800 pt-1.5 sm:pt-2 border-t border-gray-200",children:[e.jsx("span",{children:"Total"}),e.jsxs("span",{children:["₹",j(L.total)]})]})]})]})]})})]})]})]})})}),e.jsx("div",{className:"p-3 sm:p-4 md:p-6 border-t border-gray-200 bg-gray-50 sticky bottom-0",children:e.jsxs("div",{className:"flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3",children:[e.jsx("button",{type:"button",onClick:()=>{$(!1),A(null),te()},className:"px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-lg border border-gray-300 text-xs sm:text-sm md:text-base w-full sm:w-auto",children:"Cancel"}),e.jsx("button",{type:"submit",form:"order-form",disabled:m?.isNew?Le:!1,className:"px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-xs sm:text-sm md:text-base w-full sm:w-auto",children:m?.isNew?Le?"Creating...":"Create Order":"Save Changes"})]})})]})})]})};export{Dt as O,Ae as a,wt as b,bt as c,yt as d,ft as e,gt as g,Nt as n,Be as p,Ye as w};
