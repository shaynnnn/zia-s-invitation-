import { firebaseConfig, ADMIN_EMAILS } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, getDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = (s) => document.querySelector(s);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const RSVP_DEADLINE = new Date("2026-12-04T00:00:00+08:00");
const PARTY_DATE = new Date("2026-12-11T19:00:00+08:00");
const RSVP_COLLECTION = "rsvps";
const SETTINGS_DOC = "rsvpControl";
let currentUser = null, isAdmin = false, unsubscribeRsvps = null, unsubscribeControl = null, lastSeenIds = new Set(), guestSessionDocId = null, lastCalendarData = null;
let cachedGuests = [], controlOpen = null;
const adminEmails = ADMIN_EMAILS.map(e=>e.toLowerCase());
const esc = (s="") => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const isConfigured = !firebaseConfig.apiKey.startsWith("PASTE_") && !firebaseConfig.projectId.startsWith("YOUR_");
const deadlineOpen = () => Date.now() < RSVP_DEADLINE.getTime();
const rsvpIsOpen = () => controlOpen === null ? deadlineOpen() : controlOpen;
const dateText = (stamp) => { if(!stamp) return "—"; const d=stamp.toDate?stamp.toDate():new Date(stamp); return isNaN(d)?"—":d.toLocaleString("en-PH",{dateStyle:"medium",timeStyle:"short"}); };
function updateCountdown(){
  const diff=Math.max(0,PARTY_DATE.getTime()-Date.now());
  const vals=[Math.floor(diff/86400000),Math.floor(diff/3600000)%24,Math.floor(diff/60000)%60,Math.floor(diff/1000)%60];
  ["days","hours","minutes","seconds"].forEach((id,i)=>{const n=document.getElementById(id);if(n)n.textContent=String(vals[i]).padStart(2,"0");});
}
updateCountdown(); setInterval(updateCountdown,1000);
function setFormState(){
  const accepted=$('input[name="attendance"]:checked')?.value==="yes";
  $("#seatFields").classList.toggle("hidden",!accepted);
  $("#companionFields").classList.toggle("hidden",!accepted||$("#seats").value!=="2");
  $("#singleBreakdown").classList.toggle("hidden",!accepted||$("#seats").value!=="1");
  $("#companionName").required=accepted&&$("#seats").value==="2";
  $("#breakdown").required=accepted&&$("#seats").value==="2";
  const open=rsvpIsOpen(); $("#deadlineMessage").classList.toggle("hidden",open);
  if(!open){$("#deadlineMessage").textContent="RSVPs are currently closed. Please contact the organizer for any changes.";$("#openRsvp").disabled=true;$("#openRsvp").textContent="RSVP is now closed";$("#openRsvp").setAttribute("aria-disabled","true");}
  else{$("#openRsvp").disabled=false;$("#openRsvp").textContent="Open Reservation Form ✧";$("#openRsvp").removeAttribute("aria-disabled");}
}
document.querySelectorAll('input[name="attendance"]').forEach(el=>el.addEventListener("change",setFormState));$("#seats").addEventListener("change",setFormState);setFormState();
function calendarUrl(){const start="20261211T110000Z",end="20261211T120000Z";const p=new URLSearchParams({action:"TEMPLATE",text:"Zia Vie Marie's 7th Birthday",dates:`${start}/${end}`,details:"Celebrate Zia Vie Marie's Seven & Magical birthday!",location:"Jollibee Valley Golf (Volleygolf), Cainta / Antipolo area"});return "https://calendar.google.com/calendar/render?"+p.toString();}
$("#calendarButton").addEventListener("click",()=>window.open(calendarUrl(),"_blank","noopener"));
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>$("#"+b.dataset.close).classList.add("hidden")));
$("#adminOpen").addEventListener("click",()=>{$("#adminModal").classList.remove("hidden"); if(isAdmin) showAdmin();});
$("#openRsvp").addEventListener("click",()=>{if(rsvpIsOpen())$("#rsvpModal").classList.remove("hidden");else{$("#deadlineMessage").classList.remove("hidden");$("#deadlineMessage").scrollIntoView({behavior:"smooth",block:"center"});}});
async function ensureGuestAuth(){if(!isConfigured)throw new Error("Firebase is not configured. Check SETUP.md.");if(!auth.currentUser)await signInAnonymously(auth);currentUser=auth.currentUser;}
function attendanceBreakdown(form){const seats=Number(form.seats);if(form.attendance==="no")return{seats:0,adults:0,kids:0};if(seats===1)return{seats:1,adults:form.singleType==="Adult"?1:0,kids:form.singleType==="Kid"?1:0};const[a,k]=form.breakdown==="1 Adult + 1 Kid"?[1,1]:form.breakdown==="2 Adults"?[2,0]:[0,2];return{seats:2,adults:a,kids:k};}
$("#rsvpForm").addEventListener("submit",async e=>{
  e.preventDefault();$("#formError").textContent="";if(!rsvpIsOpen()){setFormState();return;}
  const form=e.currentTarget;const data=Object.fromEntries(new FormData(form).entries());data.attendance=data.attendance||"yes";const counts=attendanceBreakdown(data);
  if(data.attendance==="yes"&&(counts.seats<1||counts.seats>2)){$("#formError").textContent="Public reservations are limited to 1 or 2 seats.";return;}
  if(data.attendance==="yes"&&counts.seats===2&&!data.companionName.trim()){$("#formError").textContent="Please enter your companion's name.";return;}
  const btn=$("#submitRsvp");btn.disabled=true;btn.textContent="Sending...";
  try{await ensureGuestAuth();const payload={guestName:data.guestName.trim(),contact:data.contact.trim(),attendance:data.attendance,companionName:data.attendance==="yes"&&counts.seats===2?data.companionName.trim():"",seats:counts.seats,adults:counts.adults,kids:counts.kids,notes:(data.notes||"").trim(),ownerUid:currentUser.uid,updatedAt:serverTimestamp(),createdAt:serverTimestamp(),source:"public"};
    const ref=await addDoc(collection(db,RSVP_COLLECTION),payload);guestSessionDocId=ref.id;lastCalendarData=payload;
    $("#reservedSeats").textContent=payload.attendance==="yes"?`Your reservation: ${payload.seats} seat${payload.seats===1?"":"s"}.`:"Your response: Regretfully declines.";
    $("#thankMessage").textContent=`Thank you, ${payload.guestName}, for being part of Zia Vie Marie's magical day!`;$(`#rsvpModal`).classList.add("hidden");$("#thankYouModal").classList.remove("hidden");form.reset();setFormState();
  }catch(err){$("#formError").textContent=err.message||"Unable to submit. Please try again.";}finally{btn.disabled=false;btn.textContent="Send my RSVP ✧";}
});
onSnapshot(query(collection(db,"wishes"),orderBy("createdAt","desc")),snap=>{const wall=$("#wishesWall");if(snap.empty){wall.innerHTML='<p class="muted">Be the first to leave a birthday wish!</p>';return;}wall.innerHTML=snap.docs.map(d=>{const x=d.data();return `<article class="wish-card"><p>“${esc(x.wish)}”</p><strong>— ${esc(x.guestName||"A friend")}</strong></article>`;}).join("");},err=>console.warn("Wishes listener:",err));
function showAdmin(){isAdmin=true;$("#adminLoginView").classList.add("hidden");$("#adminDashboard").classList.remove("hidden");$("#adminModal .admin-card").classList.add("admin-full");$("#adminNotifications").textContent=`Signed in as ${currentUser?.email||"organizer"}. Dashboard is live.`;}
function showLogin(){isAdmin=false;$("#adminDashboard").classList.add("hidden");$("#adminLoginView").classList.remove("hidden");$("#adminModal .admin-card").classList.remove("admin-full");}
function isAuthorizedUser(user){return !!user&&!!user.email&&adminEmails.includes(user.email.toLowerCase());}
function updateStats(){const confirmed=cachedGuests.filter(g=>g.attendance==="yes");const declined=cachedGuests.filter(g=>g.attendance==="no");$("#statSeats").textContent=confirmed.reduce((n,g)=>n+(Number(g.seats)||0),0);$("#statAdults").textContent=confirmed.reduce((n,g)=>n+(Number(g.adults)||0),0);$("#statKids").textContent=confirmed.reduce((n,g)=>n+(Number(g.kids)||0),0);$("#statConfirmed").textContent=confirmed.length;$("#statDeclined").textContent=declined.length;const days=Math.ceil((RSVP_DEADLINE-Date.now())/86400000);$("#statDays").textContent=days>0?days:0;}
function renderGuests(){const search=( $("#guestSearch").value||"").toLowerCase().trim(),filter=$("#guestFilter").value;const filtered=cachedGuests.filter(g=>(filter==="all"||g.attendance===filter)&&(`${g.guestName||""} ${g.companionName||""} ${g.contact||""}`.toLowerCase().includes(search)));
  const tbody=$("#guestRows");if(!filtered.length){tbody.innerHTML='<tr><td colspan="8" class="empty-table">No RSVP records match this search.</td></tr>';return;}
  tbody.innerHTML=filtered.map(g=>{const status=g.attendance==="yes"?'<span class="status confirmed">Confirmed</span>':'<span class="status declined">Declined</span>';const names=`<strong>${esc(g.guestName||"(Unnamed)")}</strong>${g.companionName?`<br><span class="subguest">+ ${esc(g.companionName)}</span>`:""}`;const breakdown=`${Number(g.adults)||0} Adult / ${Number(g.kids)||0} Kid`;return `<tr><td>${names}</td><td>${status}</td><td>${g.attendance==="yes"?Number(g.seats)||0:0}</td><td>${esc(breakdown)}</td><td>${esc(g.contact||"")}</td><td>${esc(g.notes||"")}</td><td>${esc(dateText(g.updatedAt||g.createdAt))}</td><td class="action-cell"><button class="tiny-btn edit-guest" data-id="${esc(g.id)}">Edit</button><button class="tiny-btn danger delete-guest" data-id="${esc(g.id)}">Delete</button></td></tr>`;}).join("");
  tbody.querySelectorAll(".edit-guest").forEach(btn=>btn.addEventListener("click",()=>editGuest(btn.dataset.id)));tbody.querySelectorAll(".delete-guest").forEach(btn=>btn.addEventListener("click",()=>removeGuest(btn.dataset.id)));
}
function loadAdminData(){if(unsubscribeRsvps)unsubscribeRsvps();unsubscribeRsvps=onSnapshot(query(collection(db,RSVP_COLLECTION),orderBy("createdAt","desc")),snap=>{
  const fresh=snap.docs.map(d=>({id:d.id,...d.data()}));const freshIds=new Set(fresh.map(g=>g.id));const added=fresh.filter(g=>!lastSeenIds.has(g.id));if(lastSeenIds.size&&added.length){$("#adminNotifications").textContent=`${added.length} new RSVP${added.length===1?"":"s"} received: ${added.map(g=>g.guestName||"Guest").join(", ")}`;}
  lastSeenIds=freshIds;cachedGuests=fresh;updateStats();renderGuests();
},err=>{$("#adminNotifications").textContent=`Unable to load RSVPs: ${err.message}`;});
 if(unsubscribeControl)unsubscribeControl();unsubscribeControl=onSnapshot(doc(db,"settings",SETTINGS_DOC),snap=>{controlOpen=snap.exists()?Boolean(snap.data().open):null;const t=$("#rsvpOverride");t.checked=controlOpen===true; t.indeterminate=controlOpen===null;setFormState();},err=>console.warn("RSVP control listener",err));}
async function editGuest(id){const g=cachedGuests.find(x=>x.id===id);if(!g)return;const name=prompt("Guest full name:",g.guestName||"");if(name===null)return;const contact=prompt("Contact:",g.contact||"");if(contact===null)return;const status=prompt("Attendance (yes or no): ",g.attendance||"yes");if(status===null)return;if(!["yes","no"].includes(status.trim().toLowerCase())){alert("Enter yes or no.");return;}const seats=Number(prompt("Seats (0–20): ",g.seats??0));if(!Number.isInteger(seats)||seats<0||seats>20){alert("Seats must be between 0 and 20.");return;}const adults=Number(prompt("Adults: ",g.adults??0));const kids=Number(prompt("Kids: ",g.kids??0));if(!Number.isInteger(adults)||!Number.isInteger(kids)||adults<0||kids<0||adults+kids!==seats){alert("Adult and kid counts must be nonnegative and add up to the seat total.");return;}const companion=prompt("Companion name (optional): ",g.companionName||"");if(companion===null)return;const notes=prompt("Notes (optional): ",g.notes||"");if(notes===null)return;
  try{await updateDoc(doc(db,RSVP_COLLECTION,id),{guestName:name.trim(),contact:contact.trim(),attendance:status.trim().toLowerCase(),seats:status.trim().toLowerCase()==="yes"?seats:0,adults:status.trim().toLowerCase()==="yes"?adults:0,kids:status.trim().toLowerCase()==="yes"?kids:0,companionName:companion.trim(),notes:notes.trim(),updatedAt:serverTimestamp()});}catch(err){alert("Could not update RSVP: "+err.message);}}
async function removeGuest(id){const g=cachedGuests.find(x=>x.id===id);if(!confirm(`Delete RSVP for ${g?.guestName||"this guest"}? This cannot be undone.`))return;try{await deleteDoc(doc(db,RSVP_COLLECTION,id));}catch(err){alert("Could not delete RSVP: "+err.message);}}
$("#guestSearch").addEventListener("input",renderGuests);$("#guestFilter").addEventListener("change",renderGuests);
$("#exportCsv").addEventListener("click",()=>{const rows=[["Guest","Companion","Attendance","Seats","Adults","Kids","Contact","Notes","Created","Updated"],...cachedGuests.map(g=>[g.guestName||"",g.companionName||"",g.attendance||"",g.seats||0,g.adults||0,g.kids||0,g.contact||"",g.notes||"",dateText(g.createdAt),dateText(g.updatedAt)])];const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\r\n");const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="zia-rsvp-guest-list.csv";a.click();URL.revokeObjectURL(a.href);});
$("#printList").addEventListener("click",()=>window.print());
const manualGuestForm=$("#manualGuestForm");const manualAdults=manualGuestForm.elements.adults;const manualKids=manualGuestForm.elements.kids;const manualTotal=$("#manualTotalGuests");function updateManualTotal(){manualTotal.value=(Number(manualAdults.value)||0)+(Number(manualKids.value)||0);}manualAdults.addEventListener("input",updateManualTotal);manualKids.addEventListener("input",updateManualTotal);updateManualTotal();manualGuestForm.addEventListener("submit",async e=>{e.preventDefault();const form=e.currentTarget;const d=Object.fromEntries(new FormData(form).entries());const adults=Number(d.adults),kids=Number(d.kids),seats=adults+kids;if(adults<0||kids<0||adults>20||kids>20||seats>20){alert("Adult and kid counts must be between 0 and 20, with a maximum of 20 guests total.");return;}try{await addDoc(collection(db,RSVP_COLLECTION),{guestName:d.guestName.trim(),contact:d.contact.trim(),attendance:d.attendance,seats:d.attendance==="yes"?seats:0,adults:d.attendance==="yes"?adults:0,kids:d.attendance==="yes"?kids:0,companionName:"",notes:"Manually added by organizer",ownerUid:currentUser.uid,source:"admin",createdAt:serverTimestamp(),updatedAt:serverTimestamp()});form.reset();updateManualTotal();}catch(err){alert("Could not add guest: "+err.message);}});
$("#rsvpOverride").addEventListener("change",async e=>{if(!isAdmin)return;const value=e.target.checked;try{await setDoc(doc(db,"settings",SETTINGS_DOC),{open:value,updatedAt:serverTimestamp(),updatedBy:currentUser.email},{merge:true});controlOpen=value;setFormState();$("#adminNotifications").textContent=value?"RSVPs manually reopened. Public reservations are now enabled.":"RSVPs manually closed. Public reservations are disabled.";}catch(err){alert("Could not change RSVP status: "+err.message);e.target.checked=controlOpen===true;}});
$("#adminLoginForm").addEventListener("submit",async e=>{e.preventDefault();$("#adminLoginError").textContent="";const btn=$("#emailAdminLogin");btn.disabled=true;btn.textContent="Signing in...";try{if(!isConfigured)throw new Error("Firebase is not configured correctly.");const email=$("#adminEmail").value.trim().toLowerCase();if(!adminEmails.includes(email))throw new Error("This email is not authorized for organizer access.");await signInWithEmailAndPassword(auth,email,$("#adminPassword").value);if(!isAuthorizedUser(auth.currentUser))throw new Error("This account is not an organizer.");showAdmin();loadAdminData();}catch(err){$("#adminLoginError").textContent=err.message||"Unable to sign in. Please try again.";}finally{btn.disabled=false;btn.textContent="Sign in";}});
$("#adminLogout").addEventListener("click",async()=>{if(unsubscribeRsvps)unsubscribeRsvps();unsubscribeRsvps=null;if(unsubscribeControl)unsubscribeControl();unsubscribeControl=null;cachedGuests=[];lastSeenIds.clear();showLogin();await signOut(auth);});
onAuthStateChanged(auth,user=>{currentUser=user;if(isAuthorizedUser(user)){showAdmin();if(!unsubscribeRsvps)loadAdminData();}else{if(isAdmin){if(unsubscribeRsvps)unsubscribeRsvps();unsubscribeRsvps=null;if(unsubscribeControl)unsubscribeControl();unsubscribeControl=null;}showLogin();}});
