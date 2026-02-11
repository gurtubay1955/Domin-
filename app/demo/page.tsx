import ScoreBoardDemo from "@/components/game/ScoreBoard";

export default function DemoPage() {
    return (
        <div className="w-full min-h-screen bg-black flex items-center justify-center">
            {/* El contenedor simula un teléfono */}
            <ScoreBoardDemo />
        </div>
    );
}
