function generateAvatarUrl(username) {
    if (!username) return './stock/user.png';
    
    // Get first letter and make it uppercase
    const firstLetter = username.charAt(0).toUpperCase();
    
    // Generate random color
    const colors = ['1abc9c', '2ecc71', '3498db', '9b59b6', 'f1c40f', 'e67e22', 'e74c3c', '34495e'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    return `https://ui-avatars.com/api/?name=${firstLetter}&background=${color}&color=fff&size=128&bold=true`;
}

function updateUserAvatar() {
    // Check if user is logged in using your session endpoint
    fetch('http://localhost:5001/check-session', {
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        const userImage = document.querySelector('#user-avatar');
        if (!userImage) return;

        if (data.loggedIn && data.user && data.user.username) {
            // User is logged in, update avatar
            const avatarUrl = generateAvatarUrl(data.user.username);
            userImage.src = avatarUrl;
            userImage.title = data.user.username;
        } else {
            // User is not logged in, show default avatar
            userImage.src = './stock/user.png';
            userImage.title = 'Login';
        }
    })
    .catch(error => {
        console.error('Error checking session:', error);
        // On error, show default avatar
        const userImage = document.querySelector('#user-avatar');
        if (userImage) {
            userImage.src = './stock/user.png';
        }
    });
}

// Update avatar when page loads
document.addEventListener('DOMContentLoaded', updateUserAvatar);

// Export functions for use in other files
window.updateUserAvatar = updateUserAvatar;
window.generateAvatarUrl = generateAvatarUrl;
