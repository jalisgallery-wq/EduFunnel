const supabaseUrl = 'https://sciqhbmlhecpervewyld.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjaXFoYm1saGVjcGVydmV3eWxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMDQ3MDEsImV4cCI6MjA5MjY4MDcwMX0.7uLggDlAEiuZyU7pBX4DltH8iufWXEvUqcFVaK0907o';

const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Sesuaikan dengan ID di HTML: registerForm
const regisForm = document.getElementById('registerForm');

if (regisForm) {
    regisForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Ambil value sesuai ID yang ada di HTML baru kamu
        const nameInput = document.getElementById('fullName').value.trim();
        const emailInput = document.getElementById('email').value.trim();
        const passwordValue = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validasi kecocokan password
        if (passwordValue !== confirmPassword) {
            alert("Password dan Konfirmasi Password tidak cocok!");
            return;
        }

        if (passwordValue.length < 8) {
            alert("Password minimal 8 karakter");
            return;
        }

        try {
            console.log("Mendaftarkan ke Edufunnel...");

            const { data, error } = await _supabase.auth.signUp({
                email: emailInput,
                password: passwordValue,
                options: {
                    data: {
                        full_name: nameInput,
                        // Karena di HTML tidak ada input telp, kita kosongkan atau hapus baris ini
                        phone_number: "" 
                    }
                }
            });

            if (error) throw error;

            alert("Registrasi Berhasil! Silakan login.");
            regisForm.reset();
            window.location.replace("index.html"); 

        } catch (err) {
            console.error("Gagal:", err.message);
            alert("Terjadi kesalahan: " + err.message);
        }
    });
}