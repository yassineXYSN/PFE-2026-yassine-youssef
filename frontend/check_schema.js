import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

function getEnv(filePath) {
    const content = fs.readFileSync(filePath, 'utf8')
    const env = {}
    content.split('\n').forEach(line => {
        const parts = line.split('=')
        if (parts.length >= 2) {
            env[parts[0].trim()] = parts.slice(1).join('=').trim()
        }
    })
    return env
}

const env = getEnv('.env')
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

async function checkColumns() {
    const tables = ['hr_profiles', 'hr_companies', 'hr_jobs', 'hr_departments', 'candidat_applications']
    for (const t of tables) {
        console.log(`--- Table: ${t} ---`)
        const { data, error, status } = await supabase.from(t).select('*').limit(1)
        if (error) {
            console.log(`Error: ${error.message} (Status: ${status})`)
        } else if (data && data.length > 0) {
            console.log(`Columns: ${Object.keys(data[0]).join(', ')}`)
        } else {
            console.log(`Table exists but is empty. (Status: ${status})`)
        }
    }
}

checkColumns()
