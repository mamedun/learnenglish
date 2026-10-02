import { useState } from "react";
import { Gem, GraduationCap } from "lucide-react";
import AdminCoursePurchasesPanel from "./AdminCoursePurchasesPanel";
import AdminPurchasesPanel from "./AdminPurchasesPanel";

export default function AdminPurchasesHub(){const [kind,setKind]=useState("diamonds");return <div className="admin-purchases-hub"><div className="admin-tabs course-purchase-tabs" role="tablist" aria-label="Jenis pembelian"><button role="tab" aria-selected={kind==="diamonds"} className={kind==="diamonds"?"active":""} onClick={()=>setKind("diamonds")}><Gem size={16}/> Diamond</button><button role="tab" aria-selected={kind==="courses"} className={kind==="courses"?"active":""} onClick={()=>setKind("courses")}><GraduationCap size={16}/> Course</button></div>{kind==="diamonds"?<AdminPurchasesPanel/>:<AdminCoursePurchasesPanel/>}</div>;}
