const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Mengirim payload sebagai JSON biasa
      const res = await http.post("/auth/login", {
        username: username,
        email: username,
        password: password,
      });

      if (res.data) {
        const userRes = await http.get("/auth/me");
        setUser(userRes.data);
      }
    } catch (err) {
      // Coba fallback ke format token OAuth2 jika URL di atas 404
      try {
        const formData = new FormData();
        formData.append("username", username);
        formData.append("password", password);
        await http.post("/auth/token", formData);
        const userRes = await http.get("/auth/me");
        setUser(userRes.data);
      } catch (e2) {
        setError("Login gagal. Periksa kembali username dan password Anda.");
      }
    } finally {
      setLoading(false);
    }
  };
