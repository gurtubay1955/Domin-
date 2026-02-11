import { supabase } from '@/lib/supabaseClient';

// Types (mirrors of DB schema)
export interface Player {
    id?: string;
    name: string;
    nickname?: string;
}

export interface Tournament {
    id?: string;
    date: string;
    status: 'planned' | 'active' | 'finished';
    config: any;
}

export interface Pair {
    id?: string;
    tournament_id: string;
    player1_id: string;
    player2_id: string;
    pair_number: number;
    player1_name?: string; // For UI convenience
    player2_name?: string; // For UI convenience
}

export const TournamentService = {
    // 1. Create or Get Active Tournament for Today
    async getOrCreateTournament(): Promise<string | null> {
        const today = new Date().toISOString().split('T')[0];
        
        // Check existing
        const { data: existing } = await supabase
            .from('tournaments')
            .select('*')
            .eq('date', today)
            .single();

        if (existing) return existing.id;

        // Create new
        const { data: newTournament, error } = await supabase
            .from('tournaments')
            .insert({ date: today, status: 'planned' })
            .select()
            .single();
        
        if (error) {
            console.error("Error creating tournament:", error);
            return null;
        }
        return newTournament.id;
    },

    // 2. Register Players (if they don't exist) and Create Pairs
    async registerPairs(tournamentId: string, pairsData: Record<string, string[]>): Promise<boolean> {
        try {
            // Process each pair
            for (const [pairNumStr, names] of Object.entries(pairsData)) {
                const pairNum = parseInt(pairNumStr);
                const p1Name = names[0];
                const p2Name = names[1];

                // Ensure Players Exist
                const p1Id = await this._ensurePlayer(p1Name);
                const p2Id = await this._ensurePlayer(p2Name);

                if (!p1Id || !p2Id) throw new Error("Failed to register players");

                // Register Pair
                const { error } = await supabase
                    .from('pairs')
                    .insert({
                        tournament_id: tournamentId,
                        pair_number: pairNum,
                        player1_id: p1Id,
                        player2_id: p2Id
                    });
                
                if (error) throw error;
            }
            return true;
        } catch (e) {
            console.error("Error registering pairs:", e);
            return false;
        }
    },

    // Helper to get/create player by name
    async _ensurePlayer(name: string): Promise<string | null> {
        // Try find
        const { data: found } = await supabase
            .from('players')
            .select('id')
            .eq('name', name)
            .single();
        
        if (found) return found.id;

        // Create
        const { data: created, error } = await supabase
            .from('players')
            .insert({ name })
            .select('id')
            .single();
        
        if (error || !created) return null;
        return created.id;
    },

    // 3. Fetch All Pairs for specific tournament (for Table Select)
    async getPairs(tournamentId: string): Promise<Pair[]> {
        const { data, error } = await supabase
            .from('pairs')
            .select(`
                id, tournament_id, pair_number, player1_id, player2_id,
                p1:players!pairs_player1_id_fkey(name),
                p2:players!pairs_player2_id_fkey(name)
            `)
            .eq('tournament_id', tournamentId);

        if (error) {
            console.error("Error fetching pairs:", error);
            return [];
        }

        // Map to simpler structure
        return data.map((row: any) => ({
            id: row.id,
            tournament_id: row.tournament_id,
            player1_id: row.player1_id,
            player2_id: row.player2_id,
            pair_number: row.pair_number,
            player1_name: row.p1.name,
            player2_name: row.p2.name
        }));
    }
};
