# Secure Remote Access & Update Management

This document records the recommended options and best practices for accessing the ClinicSystem from multiple devices on different networks and pushing updates securely.

---

## 1. Primary Recommendation: Tailscale (Secure Overlay Network)
Tailscale is the safest and easiest way to access the system from your personal phone or home laptop without exposing it to the public internet.

### Setup Steps:
1.  **Install Tailscale**: Download and install Tailscale on the **Server**, your **Phone**, and your **Home Laptop**.
2.  **Log In**: Use the same account on all devices to form a private, encrypted "Tailnet".
3.  **Find the Private IP**: Tailscale will give your server a stable, private IP address (e.g., `100.x.y.z`).
4.  **Access the App**: On your phone or laptop, simply open the browser and go to:
    - `https://100.x.y.z:3443` (HTTPS)
    - `http://100.x.y.z:3002` (HTTP)

### Pushing Updates via Tailscale:
Tailscale allows you to securely manage the server from anywhere using **SSH**:
1.  **SSH Access**: From your home laptop, open a terminal and run:
    ```bash
    ssh sc@100.x.y.z
    ```
2.  **Pull Latest Code**: Once logged in, you can update the system using Git:
    ```bash
    cd clinicsystem
    git pull
    npm install
    # Restart the dev server or PM2 process
    ```

---

## 2. Professional Option: Cloudflare Tunnels (Public Domain)
If you want the system to be accessible via a real domain (e.g., `records.yourclinic.com`) for a wider team.

### Setup Steps:
1.  **Cloudflare Account**: Create a Cloudflare account and add your domain.
2.  **Zero Trust Dashboard**: Navigate to "Access" -> "Tunnels" and create a new tunnel.
3.  **Install Connector**: Run the provided command on your local server (e.g., `cloudflared service install ...`).
4.  **Route Traffic**: Configure the tunnel to route `records.yourclinic.com` to `localhost:3443`.
5.  **Access Policies**: Use "Cloudflare Access" to add a layer of email/MFA authentication before the login page is even shown.

---

## 3. General Security Best Practices
Regardless of the method used, these practices are essential for medical data:

*   **Multi-Factor Authentication (MFA)**: Enable MFA for all user accounts (TOTP).
*   **IP Whitelisting**: If possible, restrict access only to known IP addresses.
*   **Fail2Ban**: Install and configure Fail2Ban to block IPs that repeatedly fail login attempts.
*   **Audit Logging**: Regularly review the `audit_logs` table to monitor who is accessing and modifying data.
*   **Firewall Management**: Only keep necessary ports (e.g., 3443) open and close all others.

---

## 4. Maintenance & Backups
*   **Daily Backups**: Automated daily encrypted backups to an off-site location.
*   **Security Updates**: Regularly run `npm update` and system OS updates via SSH over Tailscale.

---

## 5. Automated Setup Scripts
To quickly set up the application on a new machine, you can use the provided install scripts located in the root directory:
* **Linux**: Run `./install_remote.sh` to install dependencies (Node.js, PostgreSQL), set up the database, and start the system via PM2.
* **Windows**: Run `install_windows.bat` (requires manual installation of Node.js and PostgreSQL first) to initialize the database and run the system.

