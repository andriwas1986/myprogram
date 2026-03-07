// js/presence.js
import { auth, rtdb } from './firebase-config.js';
import { ref, push, onValue, onDisconnect, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/**
 * Inisialisasi presence untuk user yang login via Firebase Auth
 */
export const initPresenceSystem = () => {
    const user = auth.currentUser;
    if (!user) {
        console.error("Presence Error: User belum login di Firebase Auth.");
        return;
    }

    const appId = 'default-app-id';
    const myConnectionsRef = ref(rtdb, `presence/${appId}/users/${user.uid}/connections`);
    const lastOnlineRef = ref(rtdb, `presence/${appId}/users/${user.uid}/lastOnline`);
    const connectedRef = ref(rtdb, '.info/connected');

    onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
            // bikin node unik untuk tiap koneksi
            const con = push(myConnectionsRef);
            set(con, true);

            // hapus saat disconnect
            onDisconnect(con).remove();
            // catat waktu terakhir online
            onDisconnect(lastOnlineRef).set(serverTimestamp());
        }
    });
};

/**
 * Subscribe status online semua user
 */
export const subscribeToPresence = (callback) => {
    const appId = 'default-app-id';
    const presenceRef = ref(rtdb, `presence/${appId}/users`);
    onValue(presenceRef, (snapshot) => {
        const statuses = snapshot.val() || {};
        const onlineUsers = {};
        for (const userId in statuses) {
            if (statuses[userId].connections) {
                onlineUsers[userId] = true;
            }
        }
        callback(onlineUsers);
    });
};
