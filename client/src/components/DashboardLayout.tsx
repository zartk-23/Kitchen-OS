import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { Boxes, LayoutDashboard, LogOut, Network, PanelLeft, UtensilsCrossed } from "lucide-react";
import { useRef } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/app" },
  { icon: Boxes, label: "Inventory preview", path: "/app" },
  { icon: UtensilsCrossed, label: "Menu preview", path: "/app" },
  { icon: Network, label: "Swarm workspace", path: "/app" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return <div className="flex min-h-screen items-center justify-center bg-[#071d2e]"><div className="flex w-full max-w-md flex-col items-center gap-5 p-8 text-center text-white"><h1 className="font-[Instrument_Serif] text-4xl">Sign in to continue</h1><p className="text-sm text-white/60">Access to this dashboard requires authentication. Continue with the primary sign-in, or use a controlled local test account.</p><Button onClick={() => startLogin()} size="lg" className="w-full">Sign in</Button><a href="/local-login" className="text-sm text-[#d9923b] transition-colors hover:text-white">Use a local test account</a></div></div>;
  return <SidebarProvider><DashboardLayoutContent>{children}</DashboardLayoutContent></SidebarProvider>;
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth(); const [location, setLocation] = useLocation(); const { state, toggleSidebar } = useSidebar(); const isCollapsed = state === "collapsed"; const isMobile = useIsMobile(); const sidebarRef = useRef<HTMLDivElement>(null); const activeMenuItem = menuItems.find(item => item.path === location);
  return <>{!isMobile && <div className="relative" ref={sidebarRef}><Sidebar collapsible="icon" className="border-r-0"><SidebarHeader className="h-16 justify-center"><div className="flex w-full items-center gap-3 px-2"><button onClick={toggleSidebar} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring" aria-label="Toggle navigation"><PanelLeft className="h-4 w-4 text-muted-foreground" /></button>{!isCollapsed && <span className="font-semibold tracking-tight">Navigation</span>}</div></SidebarHeader><SidebarContent className="gap-0"><SidebarMenu className="px-2 py-1">{menuItems.map(item => <SidebarMenuItem key={item.label}><SidebarMenuButton isActive={location === item.path} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-10 font-normal"><item.icon className="h-4 w-4" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarContent><SidebarFooter className="p-3"><DropdownMenu><DropdownMenuTrigger asChild><button className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left hover:bg-accent/50 group-data-[collapsible=icon]:justify-center"><Avatar className="h-9 w-9 shrink-0 border"><AvatarFallback className="text-xs font-medium">{user?.name?.charAt(0).toUpperCase()}</AvatarFallback></Avatar>{!isCollapsed && <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium leading-none">{user?.name || "-"}</p><p className="mt-1.5 truncate text-xs text-muted-foreground">{user?.email || "-"}</p></div>}</button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48"><DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive"><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem></DropdownMenuContent></DropdownMenu></SidebarFooter></Sidebar></div>}<SidebarInset className="min-w-0 w-full"><main className="min-w-0 flex-1 p-0">{isMobile && <header className="flex h-12 items-center justify-between border-b border-white/10 bg-[#071d2e] px-3 text-white"><span className="text-sm font-medium">KitchenOS / {activeMenuItem?.label || "Overview"}</span><button className="text-xs text-[#d9923b]" onClick={logout}>Sign out</button></header>}{children}</main></SidebarInset></>;
}
