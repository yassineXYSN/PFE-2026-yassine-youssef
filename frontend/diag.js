import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

function getEnv(filePath) {
    const content = fs.readFileSync(filePath, 'utf8')
    const env = {}
    content.split('\n').forEach(line => {
        const parts = line.split('=')
        if (parts.length >= 2) {
            const key = parts[0].trim()
            const value = parts.slice(1).join('=').trim()
            env[key] = value
        }
    })
    return env
}

const env = getEnv('.env')
const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function runDiagnostics() {
    const tables = [
        'profiles', 'hr_profiles',
        'companies', 'hr_companies',
        'jobs', 'hr_jobs',
        'candidates', 'candidate_applications', 'hr_applications'
    ]

    console.log(`URL: ${supabaseUrl}`)

    for (const table of tables) {
        const { data, error, status, statusText } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true })

        console.log(`[${table}] Status: ${status} | Error: ${error ? error.message : 'None'}`)
    }
}

runDiagnostics()
