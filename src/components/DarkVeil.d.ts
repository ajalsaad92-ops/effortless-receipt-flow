declare module "@/components/DarkVeil" {
  interface DarkVeilProps {
    hueShift?: number;
    noiseIntensity?: number;
    scanlineIntensity?: number;
    speed?: number;
    scanlineFrequency?: number;
    warpAmount?: number;
    resolutionScale?: number;
  }
  const DarkVeil: (props: DarkVeilProps) => JSX.Element;
  export default DarkVeil;
}