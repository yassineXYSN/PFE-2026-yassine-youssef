import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Function to parse .env file
function getEnv(filePath) {
    const content = fs.readFileSync(filePath, 'utf8')
    const env = {}
    content.split('\n').forEach(line => {
        const [key, value] = line.split('=')
        if (key && value) env[key.trim()] = value.trim()
    })
    return env
}

const env = getEnv('.env')
const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables in .env')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkTables() {
    const tables = ['profiles', 'hr_profiles', 'companies', 'hr_companies', 'jobs', 'hr_jobs', 'candidates', 'candidat_applications', 'candidate_applications']

    console.log(`Checking tables at: ${supabaseUrl}`)

    for (const table of tables) {
        try {
            const { data, error, status } = await supabase.from(table).select('id', { count: 'exact', head: true })
            if (status === 404) {
                console.log(`❌ Table: ${table.padEnd(25)} | 404 Not Found`)
            } else if (error) {
                console.log(`⚠️ Table: ${table.padEnd(25)} | Status: ${status} | Error: ${error.message}`)
            } else {
                console.log(`✅ Table: ${table.padEnd(25)} | Status: ${status} | OK`)
            }
        } catch (err) {
            console.log(`🛑 Table: ${table.padEnd(25)} | Exception: ${err.message}`)
        }
    }
}

checkTables()
