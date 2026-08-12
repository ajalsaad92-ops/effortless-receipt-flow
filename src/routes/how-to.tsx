import { createFileRoute } from '@tanstack/react-router';
import { Smartphone, Laptop, Tv, Cast, Wifi, ShieldCheck, Globe, Info } from 'lucide-react';

export const Route = createFileRoute('/how-to')({
  component: HowTo,
});

function HowTo() {
  return (
    <div className="container mx-auto px-6 py-12 max-w-4xl">
      <div className="space-y-12">
        <header className="space-y-4">
          <h1 className="text-4xl font-bold">Help & Connection Guide</h1>
          <p className="text-white/60 text-lg">Everything you need to know to get started with AirScreen.</p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[
            {
              title: "AirPlay (Apple)",
              desc: "Native mirroring for iPhone, iPad, and Mac. No extra apps needed.",
              icon: Smartphone,
              steps: [
                "Open Control Center",
                "Tap Screen Mirroring",
                "Select 'AirScreen-Receiver'"
              ]
            },
            {
              title: "Google Cast",
              desc: "Works with Android devices and Chrome browser on Windows/Mac.",
              icon: Cast,
              steps: [
                "Open Quick Settings or Chrome",
                "Tap 'Cast' or 'Cast...' in menu",
                "Select 'AirScreen-Receiver'"
              ]
            },
            {
              title: "Miracast / DLNA",
              desc: "Standard wireless display for Windows PCs and some Android brands.",
              icon: Laptop,
              steps: [
                "Press Win + K on Windows",
                "Look for Wireless Display",
                "Connect to 'AirScreen-Receiver'"
              ]
            },
            {
              title: "Advanced Options",
              desc: "Use the Web interface for devices without native casting.",
              icon: Globe,
              steps: [
                "Scan the QR code on home",
                "Enter IP address in browser",
                "Click 'Start Presentation'"
              ]
            }
          ].map((item, i) => (
            <div key={i} className="panel p-8 space-y-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/20 rounded-2xl">
                  <item.icon className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-xl font-bold">{item.title}</h2>
              </div>
              <p className="text-white/50 text-sm leading-relaxed">{item.desc}</p>
              <ul className="space-y-3">
                {item.steps.map((step, si) => (
                  <li key={si} className="flex items-center gap-3 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="panel p-8 bg-primary/5 border-primary/20 flex flex-col md:flex-row items-center gap-8">
          <div className="p-6 bg-primary/20 rounded-full">
            <ShieldCheck className="w-12 h-12 text-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold">Privacy First</h3>
            <p className="text-white/60">AirScreen uses local peer-to-peer encryption. Your data never leaves your Wi-Fi network and is never stored on our servers.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
