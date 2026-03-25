function goToDifferentScreen(file)
{
    fetch(getServerBase() + "/switchFile", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: email, password: password, file: file })
    })
        .then(response => response.json())
        .then((data) =>
        {
            if (data.success && data.redirect)
            {
                localStorage.setItem('email', email);
                localStorage.setItem('password', password);
                window.location.href = getServerBase() + data.redirect;
            }
            else if (data.message === "failed")
            {
                window.location.href = getServerBase() + "/login";
            }
        })
        .catch(error => {
            console.error("Navigation error:", error);
            window.location.href = getServerBase() + "/login";
        });
}
