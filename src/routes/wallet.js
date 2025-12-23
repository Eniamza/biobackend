import { Hono } from 'hono';
import { dbConnect } from '../../lib/db.js';
import Wallet from '../../models/wallet.js';

export const cell = new Hono()
    .post('/', async (c) => {
        const db = await dbConnect();
        const { walletId, userName, discordID } = await c.req.json();

        if (!walletId) {
            return c.text('walletId is required', 400);
        }

        // Check if wallet with the same walletId already exists
        const existingWallet = await Wallet.findOne({ walletId });
        if (existingWallet) {
            return c.text('Wallet with this walletId already exists', 409);
        }

        const newWallet = new Wallet({
            walletId,
            userName,
            discordID
        });

        const savedWallet = await newWallet.save();
        return c.json(savedWallet, 201);
    });