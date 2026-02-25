import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Briefcase, 
  Search, 
  MessageSquare, 
  PlusCircle, 
  ChevronRight, 
  Star, 
  Shield, 
  Globe, 
  Zap,
  Send,
  User as UserIcon,
  LogOut,
  LayoutDashboard,
  FileText,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import Markdown from 'react-markdown';
import { User, Project, Bid, Message, Milestone } from './types';
import { cn, formatCurrency } from './lib/utils';
import { generateJobDescription, analyzeBid } from './lib/gemini';

// --- Components ---

const Button = ({ 
  children, 
  className, 
  variant = 'primary', 
  size = 'md',
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost', size?: 'sm' | 'md' | 'lg' }) => {
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md',
    secondary: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md',
    outline: 'border border-slate-200 text-slate-700 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  };
  
  return (
    <button 
      className={cn(
        'rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className, onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={cn(
      'bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow', 
      onClick && 'cursor-pointer',
      className
    )}
  >
    {children}
  </div>
);

const Badge = ({ children, variant = 'default' }: { children: React.ReactNode, variant?: 'default' | 'success' | 'warning' }) => {
  const variants = {
    default: 'bg-slate-100 text-slate-600',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', variants[variant])}>
      {children}
    </span>
  );
};

// --- Main App ---

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<'landing' | 'login' | 'dashboard' | 'marketplace' | 'project-detail' | 'chat'>('landing');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChatPartner, setActiveChatPartner] = useState<User | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isPostingProject, setIsPostingProject] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    fetchProjects();
    const newSocket = io();
    setSocket(newSocket);
    return () => { newSocket.close(); };
  }, []);

  useEffect(() => {
    if (currentUser && socket) {
      socket.emit('join', currentUser.id);
      socket.on('receive_message', (msg: Message) => {
        setMessages(prev => [...prev, msg]);
      });
    }
  }, [currentUser, socket]);

  const fetchProjects = async () => {
    const res = await fetch('/api/projects');
    const data = await res.json();
    setProjects(data);
  };

  const handleLogin = async (role: 'buyer' | 'seller') => {
    const mockUser: User = {
      id: role === 'buyer' ? 'buyer_1' : 'seller_1',
      name: role === 'buyer' ? 'Acme Corp HR' : 'Sarah Jenkins',
      email: role === 'buyer' ? 'hr@acme.com' : 'sarah@hrconsulting.com',
      role,
      bio: role === 'seller' ? 'Senior HR Consultant with 10 years experience in tech recruitment and organizational design.' : 'Fast-growing tech startup looking for HR expertise.',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${role === 'buyer' ? 'Acme' : 'Sarah'}`
    };
    
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockUser)
    });
    
    setCurrentUser(mockUser);
    setView('dashboard');
  };

  const handlePostProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newProject = {
      id: crypto.randomUUID(),
      buyer_id: currentUser!.id,
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      budget_min: Number(formData.get('budget_min')),
      budget_max: Number(formData.get('budget_max')),
      status: 'open' as const,
    };

    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProject)
    });

    setIsPostingProject(false);
    fetchProjects();
  };

  const handlePlaceBid = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newBid = {
      id: crypto.randomUUID(),
      project_id: selectedProject!.id,
      seller_id: currentUser!.id,
      amount: Number(formData.get('amount')),
      proposal: formData.get('proposal') as string,
    };

    await fetch('/api/bids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newBid)
    });

    setView('dashboard');
    fetchProjects();
  };

  const sendMessage = (content: string) => {
    if (!socket || !currentUser || !activeChatPartner) return;
    socket.emit('send_message', {
      sender_id: currentUser.id,
      receiver_id: activeChatPartner.id,
      content
    });
  };

  // --- Views ---

  const LoginPage = () => {
    const [selectedRole, setSelectedRole] = useState<'buyer' | 'seller'>('buyer');

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 font-bold text-3xl text-indigo-600 mb-4">
              <Globe className="w-8 h-8" />
              <span>HR-Nexus</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
            <p className="text-slate-500">Sign in to your HR marketplace account</p>
          </div>

          <Card className="p-8 shadow-xl border-slate-200">
            <div className="flex p-1 bg-slate-100 rounded-xl mb-8">
              <button 
                onClick={() => setSelectedRole('buyer')}
                className={cn(
                  "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
                  selectedRole === 'buyer' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                I'm a Buyer
              </button>
              <button 
                onClick={() => setSelectedRole('seller')}
                className={cn(
                  "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
                  selectedRole === 'seller' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                I'm a Seller
              </button>
            </div>

            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleLogin(selectedRole); }}>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Email Address</label>
                <input 
                  type="email" 
                  defaultValue={selectedRole === 'buyer' ? 'hr@acme.com' : 'sarah@hrconsulting.com'}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                  placeholder="name@company.com" 
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-slate-700">Password</label>
                  <button type="button" className="text-xs text-indigo-600 font-bold hover:underline">Forgot password?</button>
                </div>
                <input 
                  type="password" 
                  defaultValue="password123"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                  placeholder="••••••••" 
                />
              </div>

              <Button type="submit" className="w-full h-12 text-lg">
                Sign In
              </Button>
            </form>

            <div className="mt-8 pt-8 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-500">
                Don't have an account? <button className="text-indigo-600 font-bold hover:underline">Create one</button>
              </p>
            </div>
          </Card>

          <button 
            onClick={() => setView('landing')}
            className="mt-8 flex items-center gap-2 text-slate-400 hover:text-slate-600 mx-auto font-medium transition-colors"
          >
            <ChevronRight className="w-4 h-4 rotate-180" /> Back to home
          </button>
        </motion.div>
      </div>
    );
  };

  const LandingPage = () => (
    <div className="min-h-screen bg-[#fcfcfc] text-slate-900">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 font-bold text-2xl tracking-tight text-indigo-600">
          <Globe className="w-8 h-8" />
          <span>HR-Nexus</span>
        </div>
        <div className="flex items-center gap-6">
          <button className="text-slate-600 hover:text-indigo-600 font-medium">For Companies</button>
          <button className="text-slate-600 hover:text-indigo-600 font-medium">For HR Experts</button>
          <Button variant="outline" onClick={() => setView('login')}>Sign In</Button>
          <Button onClick={() => setView('login')}>Get Started</Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-8 pt-20 pb-32 max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-sm font-semibold mb-6">
            <Sparkles className="w-4 h-4" />
            <span>AI-Powered Matchmaking</span>
          </div>
          <h1 className="text-6xl lg:text-7xl font-bold leading-[1.1] mb-8 tracking-tight">
            The Global Marketplace for <span className="text-indigo-600">HR Excellence.</span>
          </h1>
          <p className="text-xl text-slate-600 mb-10 leading-relaxed max-w-xl">
            Connect with top-tier HR consultants, recruiters, and agencies worldwide. 
            Scale your people operations with AI-driven precision.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button className="h-14 px-8 text-lg" onClick={() => setView('login')}>
              Hire HR Experts <ArrowRight className="w-5 h-5" />
            </Button>
            <Button variant="outline" className="h-14 px-8 text-lg" onClick={() => setView('login')}>
              Join as Consultant
            </Button>
          </div>
          <div className="mt-12 flex items-center gap-8 text-slate-400">
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-slate-900">500+</span>
              <span className="text-sm">HR Agencies</span>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-slate-900">10k+</span>
              <span className="text-sm">Projects Completed</span>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-slate-900">98%</span>
              <span className="text-sm">Client Satisfaction</span>
            </div>
          </div>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative"
        >
          <div className="absolute -inset-4 bg-indigo-500/10 blur-3xl rounded-full" />
          <Card className="relative overflow-hidden border-slate-200 shadow-2xl p-0">
            <div className="bg-slate-900 p-4 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <div className="ml-4 text-xs text-slate-400 font-mono">hr-nexus-matchmaker.ai</div>
            </div>
            <div className="p-8 space-y-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex-1 bg-slate-50 rounded-2xl p-4 text-sm text-slate-700 border border-slate-100">
                  "I've analyzed your project: <span className="font-semibold">Global Talent Acquisition Strategy</span>. Here are the top 3 matches based on expertise and past performance..."
                </div>
              </div>
              <div className="space-y-3 pl-14">
                {[
                  { name: 'Sarah Jenkins', match: '98%', tags: ['Global Mobility', 'Tech Hiring'] },
                  { name: 'PeopleFirst Agency', match: '95%', tags: ['Culture Design', 'SMEs'] },
                ].map((match, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200" />
                      <div>
                        <div className="text-sm font-semibold">{match.name}</div>
                        <div className="flex gap-1">
                          {match.tags.map(t => <span key={t} className="text-[10px] text-slate-400">{t}</span>)}
                        </div>
                      </div>
                    </div>
                    <div className="text-emerald-600 font-bold text-sm">{match.match} Match</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>
      </section>

      {/* Features */}
      <section className="bg-slate-50 py-24 px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Why HR-Nexus?</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">The only platform built specifically for the complexities of modern human resources.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: <Shield className="w-6 h-6" />, title: 'Verified Experts', desc: 'Every consultant and agency undergoes a rigorous vetting process.' },
              { icon: <Zap className="w-6 h-6" />, title: 'AI Matchmaking', desc: 'Our proprietary algorithms find the perfect fit for your specific HR needs.' },
              { icon: <Globe className="w-6 h-6" />, title: 'Global Compliance', desc: 'Built-in tools to handle cross-border contracts and local regulations.' },
            ].map((f, i) => (
              <Card key={i} className="text-center p-10">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-6">
                  {f.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                <p className="text-slate-600 leading-relaxed">{f.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );

  const Dashboard = () => (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col">
        <div className="flex items-center gap-2 font-bold text-xl text-indigo-600 mb-10">
          <Globe className="w-6 h-6" />
          <span>HR-Nexus</span>
        </div>
        
        <nav className="space-y-1 flex-1">
          <button 
            onClick={() => setView('dashboard')}
            className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors", view === 'dashboard' ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50")}
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </button>
          <button 
            onClick={() => setView('marketplace')}
            className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors", view === 'marketplace' ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50")}
          >
            <Search className="w-5 h-5" />
            Marketplace
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-slate-600 hover:bg-slate-50">
            <MessageSquare className="w-5 h-5" />
            Messages
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-slate-600 hover:bg-slate-50">
            <FileText className="w-5 h-5" />
            Contracts
          </button>
        </nav>

        <div className="pt-6 border-t border-slate-100">
          <div className="flex items-center gap-3 px-4 py-3">
            <img src={currentUser?.avatar} className="w-10 h-10 rounded-full bg-slate-100" alt="" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">{currentUser?.name}</div>
              <div className="text-xs text-slate-500 capitalize">{currentUser?.role}</div>
            </div>
          </div>
          <button 
            onClick={() => { setCurrentUser(null); setView('landing'); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-red-600 hover:bg-red-50 transition-colors mt-2"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Welcome back, {currentUser?.name.split(' ')[0]}</h1>
            <p className="text-slate-500">Here's what's happening with your HR projects today.</p>
          </div>
          {currentUser?.role === 'buyer' && (
            <Button onClick={() => setIsPostingProject(true)}>
              <PlusCircle className="w-5 h-5" /> Post a Project
            </Button>
          )}
        </header>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Active Projects */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Active Projects</h2>
                <button className="text-indigo-600 text-sm font-semibold hover:underline">View All</button>
              </div>
              <div className="space-y-4">
                {projects.filter(p => currentUser?.role === 'buyer' ? p.buyer_id === currentUser.id : true).slice(0, 3).map(project => (
                  <Card key={project.id} className="cursor-pointer group" onClick={() => { setSelectedProject(project); setView('project-detail'); }}>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-lg group-hover:text-indigo-600 transition-colors">{project.title}</h3>
                        <p className="text-slate-500 text-sm line-clamp-1">{project.description}</p>
                      </div>
                      <Badge variant={project.status === 'open' ? 'success' : 'warning'}>{project.status}</Badge>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" /> {formatCurrency(project.budget_min)} - {formatCurrency(project.budget_max)}</span>
                        <span className="flex items-center gap-1"><Users className="w-4 h-4" /> 5 Bids</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 transition-all group-hover:translate-x-1" />
                    </div>
                  </Card>
                ))}
                {projects.length === 0 && (
                  <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                    <Briefcase className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-500">No active projects yet.</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-8">
            {/* Stats / AI Assistant */}
            <Card className="bg-indigo-600 text-white border-none">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5" />
                <span className="font-bold">AI Assistant</span>
              </div>
              <p className="text-indigo-100 text-sm mb-6 leading-relaxed">
                Need help drafting a job description or analyzing bids? I'm here to assist.
              </p>
              <Button variant="secondary" className="w-full bg-white text-indigo-600 hover:bg-indigo-50 border-none">
                Try AI Assistant
              </Button>
            </Card>

            <section>
              <h2 className="text-xl font-bold mb-4">Recent Activity</h2>
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2" />
                    <div>
                      <p className="text-sm text-slate-700">New bid received for <span className="font-semibold">Technical Recruiter</span></p>
                      <span className="text-xs text-slate-400">2 hours ago</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Post Project Modal */}
      <AnimatePresence>
        {isPostingProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsPostingProject(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-2xl font-bold">Post a New HR Project</h2>
                <button onClick={() => setIsPostingProject(false)} className="text-slate-400 hover:text-slate-600">
                  <PlusCircle className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <form onSubmit={handlePostProject} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Project Title</label>
                  <input name="title" required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Technical Recruitment for Engineering Team" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-slate-700">Description</label>
                    <button 
                      type="button"
                      onClick={async () => {
                        setIsAiLoading(true);
                        const title = (document.getElementsByName('title')[0] as HTMLInputElement).value;
                        const desc = await generateJobDescription(title || "HR Project");
                        (document.getElementsByName('description')[0] as HTMLTextAreaElement).value = desc;
                        setIsAiLoading(false);
                      }}
                      className="text-xs text-indigo-600 font-bold flex items-center gap-1 hover:underline disabled:opacity-50"
                      disabled={isAiLoading}
                    >
                      <Sparkles className="w-3 h-3" /> {isAiLoading ? 'Generating...' : 'Generate with AI'}
                    </button>
                  </div>
                  <textarea name="description" required rows={4} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none resize-none" placeholder="Describe the scope of work, deliverables, and required expertise..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Min Budget ($)</label>
                    <input name="budget_min" type="number" required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="1000" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Max Budget ($)</label>
                    <input name="budget_max" type="number" required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="5000" />
                  </div>
                </div>
                <div className="pt-4 flex gap-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsPostingProject(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1">Post Project</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

  const Marketplace = () => (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Reusing Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col">
        <div className="flex items-center gap-2 font-bold text-xl text-indigo-600 mb-10">
          <Globe className="w-6 h-6" />
          <span>HR-Nexus</span>
        </div>
        <nav className="space-y-1 flex-1">
          <button onClick={() => setView('dashboard')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-slate-600 hover:bg-slate-50">
            <LayoutDashboard className="w-5 h-5" /> Dashboard
          </button>
          <button onClick={() => setView('marketplace')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium bg-indigo-50 text-indigo-600">
            <Search className="w-5 h-5" /> Marketplace
          </button>
        </nav>
      </aside>

      <main className="flex-1 p-8">
        <header className="mb-10">
          <h1 className="text-3xl font-bold mb-2">HR Project Marketplace</h1>
          <p className="text-slate-500">Find your next high-impact HR project.</p>
        </header>

        <div className="grid lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <Card className="p-4">
              <h3 className="font-bold mb-4">Filters</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Category</label>
                  <div className="mt-2 space-y-2">
                    {['Recruitment', 'Payroll', 'Consulting', 'Tech Implementation'].map(c => (
                      <label key={c} className="flex items-center gap-2 text-sm text-slate-600">
                        <input type="checkbox" className="rounded text-indigo-600" /> {c}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Budget Range</label>
                  <input type="range" className="w-full mt-2" />
                </div>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-4">
            {projects.map(project => (
              <Card key={project.id} className="cursor-pointer group" onClick={() => { setSelectedProject(project); setView('project-detail'); }}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-xl group-hover:text-indigo-600 transition-colors">{project.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-slate-500">Posted by <span className="font-semibold text-slate-700">{project.buyer_name || 'Acme Corp'}</span></span>
                      <span className="text-slate-300">•</span>
                      <span className="text-sm text-slate-500">2 hours ago</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-slate-900">{formatCurrency(project.budget_min)} - {formatCurrency(project.budget_max)}</div>
                    <Badge variant="success">Open</Badge>
                  </div>
                </div>
                <p className="text-slate-600 mb-6 line-clamp-2 leading-relaxed">{project.description}</p>
                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                  <div className="flex gap-2">
                    <Badge>Remote</Badge>
                    <Badge>Fixed Price</Badge>
                    <Badge>Intermediate</Badge>
                  </div>
                  <Button variant="outline" className="group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600">View Details</Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );

  const ProjectDetail = () => {
    const [bids, setBids] = useState<Bid[]>([]);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [matchmakingAdvice, setMatchmakingAdvice] = useState<string | null>(null);

    useEffect(() => {
      if (selectedProject) {
        fetch(`/api/projects/${selectedProject.id}/bids`)
          .then(res => res.json())
          .then(setBids);
        
        fetch(`/api/projects/${selectedProject.id}/milestones`)
          .then(res => res.json())
          .then(setMilestones);
      }
    }, [selectedProject]);

    if (!selectedProject) return null;

    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-5xl mx-auto">
          <button onClick={() => setView(currentUser?.role === 'buyer' ? 'dashboard' : 'marketplace')} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 mb-8 font-medium">
            <ChevronRight className="w-5 h-5 rotate-180" /> Back to {currentUser?.role === 'buyer' ? 'Dashboard' : 'Marketplace'}
          </button>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <Card className="p-10">
                <div className="flex items-center justify-between mb-6">
                  <h1 className="text-4xl font-bold">{selectedProject.title}</h1>
                  <Badge variant="success">Open</Badge>
                </div>
                <div className="flex items-center gap-6 mb-8 py-4 border-y border-slate-50">
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Budget</span>
                    <span className="font-bold text-lg">{formatCurrency(selectedProject.budget_min)} - {formatCurrency(selectedProject.budget_max)}</span>
                  </div>
                  <div className="w-px h-8 bg-slate-100" />
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Posted</span>
                    <span className="font-bold text-lg">Feb 24, 2026</span>
                  </div>
                  <div className="w-px h-8 bg-slate-100" />
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Location</span>
                    <span className="font-bold text-lg">Remote</span>
                  </div>
                </div>
                <div className="prose prose-slate max-w-none mb-10">
                  <h3 className="text-xl font-bold mb-4">Project Description</h3>
                  <div className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                    <Markdown>{selectedProject.description}</Markdown>
                  </div>
                </div>

                <div className="pt-10 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Zap className="w-5 h-5 text-amber-500" /> Project Milestones
                    </h3>
                    {currentUser?.role === 'buyer' && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={async () => {
                          setIsAiLoading(true);
                          const res = await fetch(`/api/projects/${selectedProject.id}/matchmaking`);
                          const data = await res.json();
                          setMatchmakingAdvice(data.advice);
                          setIsAiLoading(false);
                        }}
                        disabled={isAiLoading}
                      >
                        <Sparkles className="w-4 h-4" /> {isAiLoading ? 'Analyzing...' : 'AI Matchmaking'}
                      </Button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {milestones.map((m, i) => (
                      <div key={m.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-400">{i + 1}</div>
                          <span className="font-medium text-slate-700">{m.title}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant={m.status === 'paid' ? 'success' : 'default'}>{m.status}</Badge>
                          <span className="font-bold text-slate-900">{formatCurrency(m.amount)}</span>
                        </div>
                      </div>
                    ))}
                    {milestones.length === 0 && (
                      <p className="text-center py-4 text-slate-400 text-sm italic">No milestones defined for this project.</p>
                    )}
                  </div>
                </div>
              </Card>

              {currentUser?.role === 'buyer' && (
                <section>
                  <h2 className="text-2xl font-bold mb-6">Proposals ({bids.length})</h2>
                  <div className="space-y-4">
                    {bids.map(bid => (
                      <Card key={bid.id}>
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                              <UserIcon className="w-6 h-6 text-slate-400" />
                            </div>
                            <div>
                              <h4 className="font-bold text-lg">{bid.seller_name}</h4>
                              <div className="flex items-center gap-1 text-amber-500">
                                <Star className="w-4 h-4 fill-current" />
                                <span className="text-sm font-bold">4.9</span>
                                <span className="text-slate-400 font-normal text-xs">(12 reviews)</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-indigo-600">{formatCurrency(bid.amount)}</div>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={async () => {
                                setIsAiLoading(true);
                                const analysis = await analyzeBid(selectedProject.description, bid.proposal);
                                setAiAnalysis(analysis);
                                setIsAiLoading(false);
                              }}
                            >
                              <Sparkles className="w-4 h-4" /> AI Analysis
                            </Button>
                          </div>
                        </div>
                        <p className="text-slate-600 mb-6">{bid.proposal}</p>
                        <div className="flex gap-3">
                          <Button className="flex-1">Accept Proposal</Button>
                          <Button variant="outline" className="flex-1" onClick={() => {
                            setActiveChatPartner({ id: bid.seller_id, name: bid.seller_name!, email: '', role: 'seller' });
                            setView('chat');
                          }}>Message</Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <div className="space-y-8">
              {currentUser?.role === 'seller' && (
                <Card className="p-8 sticky top-8">
                  <h3 className="text-xl font-bold mb-6">Submit a Proposal</h3>
                  <form onSubmit={handlePlaceBid} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Your Bid Amount ($)</label>
                      <input name="amount" type="number" required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="2500" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Proposal</label>
                      <textarea name="proposal" required rows={6} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none resize-none" placeholder="Explain why you are the best fit for this project..." />
                    </div>
                    <Button type="submit" className="w-full h-12">Submit Proposal</Button>
                  </form>
                </Card>
              )}

              <Card className="p-8">
                <h3 className="font-bold mb-4">About the Client</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                      <Globe className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <div className="font-bold">Acme Corp</div>
                      <div className="text-xs text-slate-500">United States</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                    <div>
                      <div className="text-xs text-slate-400 uppercase font-bold">Spent</div>
                      <div className="font-bold">$45k+</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 uppercase font-bold">Hires</div>
                      <div className="font-bold">12</div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>

        {/* AI Analysis Modal */}
        <AnimatePresence>
          {aiAnalysis && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setAiAnalysis(null)} />
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xl p-8 overflow-y-auto max-h-[80vh]">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2 text-indigo-600 font-bold">
                    <Sparkles className="w-5 h-5" /> AI Bid Analysis
                  </div>
                  <button onClick={() => setAiAnalysis(null)} className="text-slate-400 hover:text-slate-600"><PlusCircle className="w-6 h-6 rotate-45" /></button>
                </div>
                <div className="prose prose-indigo">
                  <Markdown>{aiAnalysis}</Markdown>
                </div>
                <Button className="w-full mt-8" onClick={() => setAiAnalysis(null)}>Close Analysis</Button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* AI Matchmaking Modal */}
        <AnimatePresence>
          {matchmakingAdvice && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setMatchmakingAdvice(null)} />
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-8 overflow-y-auto max-h-[80vh]">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2 text-indigo-600 font-bold">
                    <Sparkles className="w-5 h-5" /> AI Matchmaking Recommendations
                  </div>
                  <button onClick={() => setMatchmakingAdvice(null)} className="text-slate-400 hover:text-slate-600"><PlusCircle className="w-6 h-6 rotate-45" /></button>
                </div>
                <div className="prose prose-indigo max-w-none">
                  <Markdown>{matchmakingAdvice}</Markdown>
                </div>
                <Button className="w-full mt-8" onClick={() => setMatchmakingAdvice(null)}>Close Recommendations</Button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const ChatView = () => {
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    if (!activeChatPartner) return null;

    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="px-8 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('dashboard')} className="text-slate-400 hover:text-indigo-600"><ChevronRight className="w-6 h-6 rotate-180" /></button>
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><UserIcon className="w-5 h-5 text-slate-400" /></div>
            <div>
              <div className="font-bold">{activeChatPartner.name}</div>
              <div className="text-xs text-emerald-500 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Online</div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-4">
          {messages.filter(m => (m.sender_id === currentUser?.id && m.receiver_id === activeChatPartner.id) || (m.sender_id === activeChatPartner.id && m.receiver_id === currentUser?.id)).map((m, i) => (
            <div key={i} className={cn("flex", m.sender_id === currentUser?.id ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[70%] px-4 py-3 rounded-2xl text-sm", m.sender_id === currentUser?.id ? "bg-indigo-600 text-white rounded-tr-none" : "bg-slate-100 text-slate-800 rounded-tl-none")}>
                {m.content}
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        <div className="p-8 border-t border-slate-100">
          <form className="flex gap-4" onSubmit={(e) => { e.preventDefault(); sendMessage(input); setInput(''); }}>
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none" 
              placeholder="Type your message..." 
            />
            <Button type="submit" className="w-14 h-14 rounded-2xl p-0"><Send className="w-6 h-6" /></Button>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="font-sans">
      {view === 'landing' && <LandingPage />}
      {view === 'login' && <LoginPage />}
      {view === 'dashboard' && <Dashboard />}
      {view === 'marketplace' && <Marketplace />}
      {view === 'project-detail' && <ProjectDetail />}
      {view === 'chat' && <ChatView />}
    </div>
  );
}
