   function goToDifferentScreen(file)
    {
        
        fetch("http://localhost:8080/switchFile", {
            // Defines the HTTP verb as POST, which is used for sending data to a server.
            method: 'POST',
            headers: {
                // Informs the server that the data being sent is formatted as a JSON string.
                'Content-Type': 'application/json'
            },

            body: JSON.stringify({ email: email,password: password,file:file })
        })
            .then(response =>
            {
                if (response.redirected)
                {
                    localStorage.setItem('email', email);
                    localStorage.setItem('password', password);
                    window.location.href = response.url;
                    return;
                }
                return response.json();
            })
          

    }
    