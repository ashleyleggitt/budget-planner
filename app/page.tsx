import { useState } from "react";
import "./App.css";

export default function App() {

const months = [
"January","February","March","April","May","June",
"July","August","September","October","November","December"
];

const today = new Date();
const [monthIndex,setMonthIndex] = useState(today.getMonth());
const [tab,setTab] = useState("bills");

const [bills,setBills] = useState([]);
const [income,setIncome] = useState([]);
const [savings,setSavings] = useState([]);
const [calendarNotes,setCalendarNotes] = useState({});

function addBill(name,amount,recurring){
setBills([...bills,{
id:Date.now(),
name,
amount,
recurring,
paid:false
}])
}

function toggleBill(id){
setBills(bills.map(b=>{
if(b.id===id){
return {...b,paid:!b.paid}
}
return b
}))
}

function addIncome(name,amount){
setIncome([...income,{
id:Date.now(),
name,
amount
}])
}

function addSaving(name,target){
setSavings([...savings,{
id:Date.now(),
name,
target
}])
}

const planned = bills.reduce((a,b)=>a+Number(b.amount||0),0);
const paid = bills.filter(b=>b.paid).reduce((a,b)=>a+Number(b.amount||0),0);
const remaining = planned-paid;

const totalIncome = income.reduce((a,b)=>a+Number(b.amount||0),0);
const totalSavings = savings.reduce((a,b)=>a+Number(b.target||0),0);

const days = Array.from({length:31},(_,i)=>i+1);

return(

<div className="app">

<h1 className="title">Bill Reminder + Budget Tracker</h1>

<div className="monthBar">
<button onClick={()=>setMonthIndex((monthIndex+11)%12)}>‹</button>
<h2>{months[monthIndex]} {today.getFullYear()}</h2>
<button onClick={()=>setMonthIndex((monthIndex+1)%12)}>›</button>
</div>

<div className="stats">

<div className="card">
<span>PLANNED BILLS</span>
<h3>${planned.toFixed(2)}</h3>
</div>

<div className="card">
<span>PAID</span>
<h3>${paid.toFixed(2)}</h3>
</div>

<div className="card">
<span>REMAINING</span>
<h3>${remaining.toFixed(2)}</h3>
</div>

<div className="card">
<span>INCOME</span>
<h3>${totalIncome.toFixed(2)}</h3>
</div>

<div className="card">
<span>SAVINGS</span>
<h3>${totalSavings.toFixed(2)}</h3>
</div>

</div>

<div className="tabs">

<button
className={tab==="bills"?"active":""}
onClick={()=>setTab("bills")}
>
Bills
</button>

<button
className={tab==="budget"?"active":""}
onClick={()=>setTab("budget")}
>
Budget & Savings
</button>

<button
className={tab==="calendar"?"active":""}
onClick={()=>setTab("calendar")}
>
Calendar
</button>

</div>

{tab==="bills" && (

<div className="panel">

<h3>Bills Checklist</h3>

<AddBill addBill={addBill}/>

<div className="totals">
<div>Planned ${planned.toFixed(2)}</div>
<div>Paid ${paid.toFixed(2)}</div>
<div>Remaining ${remaining.toFixed(2)}</div>
</div>

<h4>Unpaid Bills</h4>

{bills.filter(b=>!b.paid).length===0 &&
<p className="empty">No unpaid bills.</p>}

{bills.filter(b=>!b.paid).map(b=>(

<div key={b.id} className="bill">

<input
type="checkbox"
checked={b.paid}
onChange={()=>toggleBill(b.id)}
/>

<span>{b.name}</span>

<span>${b.amount}</span>

</div>

))}

<details className="paidSection">

<summary>Paid Bills ({bills.filter(b=>b.paid).length})</summary>

{bills.filter(b=>b.paid).map(b=>(

<div key={b.id} className="bill paid">

<input
type="checkbox"
checked={b.paid}
onChange={()=>toggleBill(b.id)}
/>

<span>{b.name}</span>

<span>${b.amount}</span>

</div>

))}

</details>

</div>
)}

{tab==="budget" && (

<div className="panel">

<h3>Income</h3>

<AddIncome addIncome={addIncome}/>

{income.map(i=>(

<div key={i.id} className="row">
<span>{i.name}</span>
<span>${i.amount}</span>
</div>

))}

<h3>Savings Buckets</h3>

<AddSaving addSaving={addSaving}/>

{savings.map(s=>(

<div key={s.id} className="row">
<span>{s.name}</span>
<span>${s.target}</span>
</div>

))}

</div>

)}

{tab==="calendar" && (

<div className="panel">

<h3>Monthly Calendar</h3>

<div className="calendar">

{days.map(d=>(

<div key={d} className="day">
{d}
</div>

))}

</div>

<div className="calendarNotes">

<h3>Notes</h3>

<textarea
placeholder="Work schedule, reminders, projects..."
/>

</div>

</div>

)}

</div>
)
}

function AddBill({addBill}){

const [name,setName] = useState("");
const [amount,setAmount] = useState("");
const [recurring,setRecurring] = useState(false);

return(

<div className="addRow">

<input
placeholder="Rent, phone..."
value={name}
onChange={e=>setName(e.target.value)}
/>

<input
placeholder="$"
value={amount}
onChange={e=>setAmount(e.target.value)}
/>

<label>

<input
type="checkbox"
checked={recurring}
onChange={e=>setRecurring(e.target.checked)}
/>

Recurring

</label>

<button onClick={()=>{

addBill(name,amount,recurring)
setName("")
setAmount("")

}}>
Add
</button>

</div>

)
}

function AddIncome({addIncome}){

const [name,setName] = useState("")
const [amount,setAmount] = useState("")

return(

<div className="addRow">

<input
placeholder="Paycheck, side income"
value={name}
onChange={e=>setName(e.target.value)}
/>

<input
placeholder="$ amount"
value={amount}
onChange={e=>setAmount(e.target.value)}
/>

<button onClick={()=>{

addIncome(name,amount)
setName("")
setAmount("")

}}>
Add
</button>

</div>

)
}

function AddSaving({addSaving}){

const [name,setName] = useState("")
const [target,setTarget] = useState("")

return(

<div className="addRow">

<input
placeholder="Emergency fund"
value={name}
onChange={e=>setName(e.target.value)}
/>

<input
placeholder="$ target"
value={target}
onChange={e=>setTarget(e.target.value)}
/>

<button onClick={()=>{

addSaving(name,target)
setName("")
setTarget("")

}}>
Add
</button>

</div>

)
}