import { useState } from "react";
import { erpCompanies } from "@/data/erp-mock";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Building2, Search, Filter, Download, Plus, MoreHorizontal, Mail, Phone, MapPin, 
  ExternalLink, Edit2, ShieldCheck, CreditCard, ChevronRight, LayoutGrid, List,
  Users, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

export function CompanyManagement() {
  const [search, setSearch] = useState("");
  const [activeCompanyId, setActiveCompanyId] = useState<string>(erpCompanies[0].id);

  const activeCompany = erpCompanies.find(c => c.id === activeCompanyId) || erpCompanies[0];
  const filteredCompanies = erpCompanies.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.gst.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* Master Column - Company List */}
      <div className="w-80 lg:w-96 flex flex-col border-r bg-muted/10 shrink-0 h-full">
        <div className="p-4 border-b bg-background sticky top-0 z-10">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="size-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">Company Management</h2>
          </div>
          <p className="text-muted-foreground text-xs mb-4">Manage multiple legal entities and organizations within your ERP.</p>
          
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input 
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-xs rounded-md border bg-card focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground" 
                placeholder="Search companies by name, GST, or industry..." 
              />
            </div>
            <Button variant="outline" size="sm" className="h-8 px-2.5"><Filter className="size-3.5 mr-1" /> Filters</Button>
          </div>
          <div className="flex justify-between items-center mt-3">
            <span className="text-[10px] font-semibold text-muted-foreground">Showing 1 to {filteredCompanies.length} of {erpCompanies.length} companies</span>
            <div className="flex bg-muted rounded-md p-0.5">
              <button className="p-1 rounded-sm bg-background shadow-sm text-foreground"><List className="size-3" /></button>
              <button className="p-1 rounded-sm text-muted-foreground"><LayoutGrid className="size-3" /></button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
          {filteredCompanies.map(company => {
            const isActive = company.id === activeCompanyId;
            return (
              <button 
                key={company.id}
                onClick={() => setActiveCompanyId(company.id)}
                className={cn(
                  "w-full text-left p-4 rounded-xl border transition-all relative flex flex-col gap-3 group",
                  isActive 
                    ? "bg-primary/5 border-primary/30 shadow-sm" 
                    : "bg-card hover:border-primary/20 hover:shadow-sm"
                )}
              >
                <div className="flex gap-3 w-full">
                  <div className="size-10 rounded-lg gradient-brand text-white grid place-items-center font-bold text-sm shrink-0">
                    {company.logo}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h3 className={cn("font-bold text-sm tracking-tight truncate", isActive ? "text-primary" : "text-foreground")}>{company.name}</h3>
                    <p className="text-[10px] text-muted-foreground truncate">{company.type} • {company.industry}</p>
                    
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className={`size-1.5 rounded-full ${company.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <span className={cn("text-[10px] font-medium", company.status === 'Active' ? 'text-emerald-600' : 'text-rose-600')}>{company.status}</span>
                    </div>
                  </div>
                </div>
                
                <div className="w-full text-[10px] font-mono text-muted-foreground pt-2 border-t flex justify-between items-center">
                  <span>GST: {company.gst}</span>
                  <ChevronRight className={cn("size-3.5 transition-transform", isActive ? "text-primary translate-x-0.5" : "text-muted-foreground opacity-0 group-hover:opacity-100")} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail Column */}
      <div className="flex-1 overflow-y-auto bg-background p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Top Actions */}
          <div className="flex justify-end gap-2 mb-2">
            <Button variant="outline" size="sm" className="h-9 gap-2"><Download className="size-4" /> Import</Button>
            <Button variant="outline" size="sm" className="h-9 gap-2"><ExternalLink className="size-4" /> Export</Button>
            <Button size="sm" className="h-9 gap-2 gradient-brand text-white border-0"><Plus className="size-4" /> Create Company</Button>
          </div>

          {/* Company Header */}
          <div className="bg-card border rounded-2xl p-6">
            <div className="flex justify-between items-start mb-8">
              <div className="flex gap-5">
                <div className="size-16 rounded-2xl gradient-brand text-white grid place-items-center font-bold text-2xl shadow-elegant">
                  {activeCompany.logo}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl font-black tracking-tight">{activeCompany.name}</h1>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${activeCompany.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                      <span className={`size-1.5 rounded-full ${activeCompany.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {activeCompany.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{activeCompany.type} • {activeCompany.industry}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-9"><Edit2 className="size-3.5 mr-2" /> Edit</Button>
                <Button variant="outline" size="icon" className="h-9 w-9"><MoreHorizontal className="size-4" /></Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-6 border-b">
              <div>
                <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Legal Name</div>
                <div className="text-sm font-medium">{activeCompany.legalName}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1 flex items-center gap-1"><Mail className="size-3" /> Email</div>
                <div className="text-sm font-medium">{activeCompany.email}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1 flex items-center gap-1"><Phone className="size-3" /> Phone</div>
                <div className="text-sm font-medium">{activeCompany.phone}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1 flex items-center gap-1"><MapPin className="size-3" /> Website</div>
                <div className="text-sm font-medium text-primary hover:underline cursor-pointer">{activeCompany.website}</div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-6 mt-4 overflow-x-auto scrollbar-hide">
              {['Overview', 'Additional Info', 'Tax & Finance', 'Subscription', 'Branches (12)', 'Contacts', 'Documents', 'Notes'].map((tab, i) => (
                <button 
                  key={tab} 
                  className={cn(
                    "text-sm font-semibold pb-3 border-b-2 whitespace-nowrap transition-colors",
                    i === 0 ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* General Info */}
            <Card className="p-6 h-fit">
              <div className="flex items-center gap-2 mb-6 text-foreground">
                <Building2 className="size-4 text-primary" />
                <h3 className="font-bold">General Information</h3>
              </div>
              <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground mb-1">GST Number</div>
                  <div className="text-sm font-mono">{activeCompany.gst}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground mb-1">Country</div>
                  <div className="text-sm">{activeCompany.country}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground mb-1">PAN Number</div>
                  <div className="text-sm font-mono">{activeCompany.pan}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground mb-1">State</div>
                  <div className="text-sm">{activeCompany.state}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground mb-1">Registration Number</div>
                  <div className="text-sm font-mono">{activeCompany.regNo}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground mb-1">City</div>
                  <div className="text-sm">{activeCompany.city}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground mb-1">Industry</div>
                  <div className="text-sm">{activeCompany.industry}</div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <div className="text-[10px] font-semibold text-muted-foreground mb-1">Address</div>
                  <div className="text-sm">{activeCompany.address}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground mb-1">Business Type</div>
                  <div className="text-sm">{activeCompany.type}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground mb-1">Timezone</div>
                  <div className="text-sm">{activeCompany.timezone}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground mb-1">Currency</div>
                  <div className="text-sm">{activeCompany.currency}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground mb-1">Language</div>
                  <div className="text-sm">{activeCompany.language}</div>
                </div>
              </div>
            </Card>

            {/* Financial Summary */}
            <Card className="p-6 h-fit bg-muted/5">
              <div className="flex items-center gap-2 mb-6 text-foreground">
                <CreditCard className="size-4 text-primary" />
                <h3 className="font-bold">Financial & Operational Summary</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-card border rounded-lg p-3">
                  <div className="text-[10px] font-semibold text-muted-foreground mb-1">Financial Year</div>
                  <div className="text-sm font-medium">{activeCompany.financialYear}</div>
                </div>
                <div className="bg-card border rounded-lg p-3">
                  <div className="text-[10px] font-semibold text-muted-foreground mb-1">Currency</div>
                  <div className="text-sm font-medium">{activeCompany.currency}</div>
                </div>
                <div className="bg-card border rounded-lg p-3">
                  <div className="text-[10px] font-semibold text-muted-foreground mb-1">Tax Regime</div>
                  <div className="text-sm font-medium">{activeCompany.taxConfig}</div>
                </div>
                <div className="bg-card border rounded-lg p-3">
                  <div className="text-[10px] font-semibold text-muted-foreground mb-1">Default Payment Terms</div>
                  <div className="text-sm font-medium">30 Days</div>
                </div>
                <div className="bg-card border rounded-lg p-3">
                  <div className="text-[10px] font-semibold text-muted-foreground mb-1">Default Credit Limit</div>
                  <div className="text-sm font-medium font-mono">₹50,00,000</div>
                </div>
                <div className="bg-card border rounded-lg p-3">
                  <div className="text-[10px] font-semibold text-muted-foreground mb-1">Company Status</div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold mt-0.5 ${activeCompany.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                    <span className={`size-1.5 rounded-full ${activeCompany.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    {activeCompany.status}
                  </span>
                </div>
              </div>
            </Card>
          </div>
          
          {/* Subscription Plan */}
          <Card className="p-6 border-primary/20 bg-primary/5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex gap-4 items-center">
                <div className="size-12 rounded-lg bg-primary text-primary-foreground grid place-items-center shadow-md">
                  <ShieldCheck className="size-6" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-0.5">Subscription Plan</div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-black">{activeCompany.plan} Plan</h4>
                    <span className="bg-primary/20 text-primary px-2 py-0.5 rounded text-[10px] font-bold">Active</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Renews on 15 Aug 2025</div>
                </div>
              </div>
              
              <div className="flex gap-8 text-sm">
                <div>
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-semibold mb-1"><Users className="size-3.5" /> Users</div>
                  <div className="font-mono font-medium">250 <span className="text-muted-foreground">/ 500</span></div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-semibold mb-1"><CreditCard className="size-3.5" /> Storage</div>
                  <div className="font-mono font-medium">120 GB <span className="text-muted-foreground">/ 500 GB</span></div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-semibold mb-1"><Sparkles className="size-3.5" /> AI Credits</div>
                  <div className="font-mono font-medium">18,500 <span className="text-muted-foreground">/ 50,000</span></div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-semibold mb-1"><Building2 className="size-3.5" /> Branches</div>
                  <div className="font-mono font-medium">12 <span className="text-muted-foreground">/ 50</span></div>
                </div>
              </div>

              <Button variant="outline" className="h-10 bg-background hover:bg-muted font-semibold">Manage Subscription</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
