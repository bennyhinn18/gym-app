import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from '@remix-run/react';
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "~/components/ui/sheet";
import { Plus, Menu, LayoutDashboard, Building, CreditCard, Settings, ChevronRight, Home, ChevronLeft } from 'lucide-react';

export default function AdminDashboard() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const location = useLocation();


  

  const sidebarItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/admin/dashboard' },
    { icon: Building, label: 'Facilities', href: '/admin/facilities' },
    { icon: CreditCard, label: 'Subscriptions', href: '/admin/subscriptions/index' },
    { icon: Settings, label: 'Settings', href: '/admin/settings' },
  ];

  const Sidebar = ({ isMobile = false }) => (
    <ScrollArea className={`h-full py-6 ${isDesktopSidebarOpen || isMobile ? 'px-6' : 'px-2'}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className={`text-lg font-semibold ${!isDesktopSidebarOpen && !isMobile ? 'hidden' : ''}`}>Admin Dashboard</h2>
        {!isMobile && (
          <Button variant="ghost" size="icon" onClick={() => setIsDesktopSidebarOpen(!isDesktopSidebarOpen)}>
            {isDesktopSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        )}
      </div>
      <nav className="space-y-2">
        {sidebarItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-gray-500 transition-all hover:text-gray-900 ${
              location.pathname === item.href ? 'bg-gray-100 text-gray-900' : ''
            }`}
            title={item.label}
          >
            <item.icon className="h-4 w-4" />
            {(isDesktopSidebarOpen || isMobile) && (
              <>
                <span>{item.label}</span>
                <ChevronRight className="ml-auto h-4 w-4" />
              </>
            )}
          </Link>
        ))}
      </nav>
    </ScrollArea>
  );

  const Breadcrumbs = () => {
    const pathSegments = location.pathname.split('/').filter(segment => segment);
    const breadcrumbs = pathSegments.map((segment, index) => {
      const url = `/${pathSegments.slice(0, index + 1).join('/')}`;
      const label = segment.charAt(0).toUpperCase() + segment.slice(1);
      return { label, url };
    });

    return (
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex items-center space-x-2 text-sm text-gray-500">
          <li>
            <Link to="/admin/dashboard" className="hover:text-gray-700">
              <Home className="h-4 w-4" />
              <span className="sr-only">Home</span>
            </Link>
          </li>
          {breadcrumbs.map((crumb, index) => (
            <li key={crumb.url} className="flex items-center">
              <ChevronRight className="h-4 w-4 mx-1" />
              {index === breadcrumbs.length - 1 ? (
                <span className="font-medium text-gray-900">{crumb.label}</span>
              ) : (
                <Link to={crumb.url} className="hover:text-gray-700">
                  {crumb.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar for desktop */}
      <aside className={`hidden lg:flex lg:flex-col ${isDesktopSidebarOpen ? 'lg:w-64' : 'lg:w-16'} transition-all duration-300 ease-in-out`}>
        <Sidebar />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <Sidebar isMobile={true} />
        </SheetContent>
      </Sheet>

      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <header className="flex items-center justify-between p-4 border-b lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => setIsMobileSidebarOpen(true)}>
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
          </Sheet>
          <h1 className="text-xl font-bold">Admin Dashboard</h1>
          <div className="w-6" /> {/* Placeholder for alignment */}
        </header>

        {/* Main content */}
        <div className="p-6">
          <Breadcrumbs />
          <Outlet />
        </div>

        {/* Floating action button */}
        <Link to="/admin/add-facility" className="fixed right-6 bottom-6">
          <Button size="icon" className="h-14 w-14 rounded-full">
            <Plus className="h-6 w-6" />
          </Button>
        </Link>
      </main>
    </div>
  );
}