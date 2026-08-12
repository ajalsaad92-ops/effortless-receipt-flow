import { createFileRoute } from '@tanstack/react-router';
import { Settings as SettingsIcon, Monitor, Wifi, Shield, Bell, HardDrive, Info } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

export const Route = createFileRoute('/settings')({
  component: Settings,
});

function Settings() {
  return (
    <div className="container mx-auto px-6 py-12 max-w-3xl">
      <div className="space-y-12">
        <header className="space-y-4">
          <h1 className="text-4xl font-bold flex items-center gap-4">
            <SettingsIcon className="w-10 h-10 text-primary" />
            Settings
          </h1>
          <p className="text-white/60 text-lg">Configure your receiver preferences and performance.</p>
        </header>

        <div className="space-y-8">
          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-white/40 px-2">General</h2>
            <div className="panel divide-y divide-white/5 overflow-hidden">
              <div className="p-6 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold">
                    <Monitor className="w-4 h-4 text-primary" />
                    Device Name
                  </div>
                  <p className="text-sm text-white/50">How your device appears to others</p>
                </div>
                <div className="text-primary font-mono text-sm px-3 py-1 bg-primary/10 rounded-lg border border-primary/20">
                  AirScreen-Receiver
                </div>
              </div>
              <div className="p-6 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold">
                    <Wifi className="w-4 h-4 text-primary" />
                    Auto-Connect
                  </div>
                  <p className="text-sm text-white/50">Allow known devices to connect automatically</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-white/40 px-2">Casting Protocols</h2>
            <div className="panel divide-y divide-white/5 overflow-hidden">
              {[
                { label: "AirPlay", desc: "Support for Apple devices", icon: Smartphone },
                { label: "Google Cast", desc: "Support for Android and Chrome", icon: Cast },
                { label: "Miracast", desc: "Support for Windows and some Androids", icon: Laptop }
              ].map((protocol, i) => (
                <div key={i} className="p-6 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="font-bold">{protocol.label}</div>
                    <p className="text-sm text-white/50">{protocol.desc}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-white/40 px-2">Privacy & Security</h2>
            <div className="panel divide-y divide-white/5 overflow-hidden">
              <div className="p-6 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold">
                    <Shield className="w-4 h-4 text-primary" />
                    PIN Protection
                  </div>
                  <p className="text-sm text-white/50">Require a PIN for all new connections</p>
                </div>
                <Switch />
              </div>
            </div>
          </section>

          <div className="flex items-center justify-center gap-4 text-xs text-white/30 pt-8">
            <span className="flex items-center gap-1"><Info className="w-3 h-3" /> Version 2.4.0</span>
            <span>•</span>
            <span>Build 2026.08.12</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Quick helper icons if not imported
function Smartphone(props: any) { return <Monitor {...props} /> }
function Cast(props: any) { return <Monitor {...props} /> }
function Laptop(props: any) { return <Monitor {...props} /> }
