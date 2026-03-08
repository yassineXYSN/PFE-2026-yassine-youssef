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

async function inspectSchema() {
    console.log('--- Inspecting hr_profiles type ---')
    // We can try to query information_schema if permissions allow, 
    // but usually anon key can't. 
    // Instead, we'll try to check if there's an actual 'profiles' table that was hidden.

    const { data: tables, error: tableError } = await supabase
        .from('hr_profiles')
        .select('*')
        .limit(1)

    if (tableError) {
        console.log('Error querying hr_profiles:', tableError.message)
        console.log('Error details:', tableError)
    } else {
        console.log('Successfully queried hr_profiles. Data:', tables)
    }

    console.log('--- Checking for other possible names ---')
    const others = ['profiles', 'hr_profile', 'user_profiles', 'hr_users']
    for (const name of others) {
        const { status, error } = await supabase.from(name).select('id').limit(1)
        console.log(`Table ${name}: Status ${status}, Error: ${error ? error.message : 'None'}`)
    }
}

inspectSchema()
