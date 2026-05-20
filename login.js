const supabaseUrl = 'https://sciqhbmlhecpervewyld.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjaXFoYm1saGVjcGVydmV3eWxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMDQ3MDEsImV4cCI6MjA5MjY4MDcwMX0.7uLggDlAEiuZyU7pBX4DltH8iufWXEvUqcFVaK0907o';

// Inisialisasi Supabase
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

const loginForm = document.getElementById('loginForm');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Mengambil value berdasarkan ID yang ada di index.html
    const email = document.getElementById('email').value; 
    const password = document.getElementById('password').value;

    try {
        console.log("Mencoba login...");

        const { data, error } = await _supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) throw error;

        if (data.user) {
            // Mengarahkan ke dashboard.html (sesuaikan case-sensitive nama filenya)
            window.location.replace("dashboard.html");
        }

    } catch (error) {
        console.error("Gagal Login:", error.message);
        
        if (error.message === "Invalid login credentials") {
            alert("Email atau password salah. Silakan coba lagi.");
        } else {
            alert("Terjadi kesalahan: " + error.message);
        }
    }
});