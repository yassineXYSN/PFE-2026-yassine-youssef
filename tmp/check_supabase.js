import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: '../frontend/.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkTables() {
    const tables = ['profiles', 'hr_profiles', 'companies', 'hr_companies', 'jobs', 'hr_jobs', 'candidates', 'candidat_applications', 'candidate_applications']

    for (const table of tables) {
        const { data, error, status } = await supabase.from(table).select('id').limit(1)
        console.log(`Table: ${table} | Status: ${status} | Error: ${error ? error.message : 'None'}`)
    }
}

checkTables()
