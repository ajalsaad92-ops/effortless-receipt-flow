import { createFileRoute } from '@tanstack/react-router';
import { Monitor, Smartphone, Laptop, Tv, Cast, Wifi, ShieldCheck, Zap } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export const Route = createFileRoute('/')({
  component: Index,
});

function Index() {
  const serverIp = "192.168.1.15"; // Simulated
  const port = "8080";
  
  return (
    <div className="container mx-auto px-6 py-12 flex flex-col items-center text-center">
      <div className="max-w-3xl space-y-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold uppercase tracking-widest border border-emerald-500/20">
          <Zap className="w-3 h-3" />
          Receiver is Active
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
          Wireless Screen Mirroring <br />
          <span className="text-emerald-500">Made Simple.</span>
        </h1>
        
        <p className="text-xl text-white/50 max-w-2xl mx-auto">
          AirScreen turns your device into a powerful receiver for AirPlay, Google Cast, and Miracast. 
          Connect instantly from any device.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-16 text-left">
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 backdrop-blur-sm space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-xl">
                <Wifi className="w-6 h-6 text-emerald-500" />
              </div>
              How to Connect
            </h2>
            <div className="space-y-4 text-white/70">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white">1</div>
                <p>Ensure your device is on the same Wi-Fi network: <span className="text-white font-medium">Home_5G</span></p>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white">2</div>
                <p>Open the casting menu on your Phone, Tablet, or PC.</p>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white">3</div>
                <p>Select <span className="text-emerald-500 font-bold italic">AirScreen-Receiver</span> from the list.</p>
              </div>
            </div>
          </div>

          <div className="bg-emerald-500 border border-emerald-400 rounded-3xl p-8 flex flex-col items-center justify-center space-y-4 text-black text-center shadow-[0_0_50px_rgba(16,185,129,0.2)]">
            <div className="bg-white p-4 rounded-2xl shadow-xl">
              <QRCodeSVG value={`http://${serverIp}:${port}`} size={160} />
            </div>
            <div>
              <p className="font-bold text-lg">Scan to Help</p>
              <p className="text-black/60 text-sm">Open help manual on your phone</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
          {[
            { icon: Smartphone, label: "iOS / Android" },
            { icon: Laptop, label: "macOS / Windows" },
            { icon: Tv, label: "Android TV" },
            { icon: Cast, label: "Chromecast" }
          ].map((item, i) => (
            <div key={i} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center gap-3">
              <item.icon className="w-6 h-6 text-white/40" />
              <span className="text-xs font-medium text-white/40">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
