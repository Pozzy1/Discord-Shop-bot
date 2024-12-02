const { Client, Intents, GatewayIntentBits, REST, Routes } = require('discord.js');
require('dotenv').config();

// Set up the bot client
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// Points system
const users = {}; // Store user points and purchased roles

// Roles and point requirements
const rolesConfig = {
    "Well-Known": 10,
    "Respected": 20,
    "Elite": 30,
    "Legend": 50,
    "Divine": 100
};

// Create slash commands
const commands = [
    {
        name: 'points',
        description: 'Check your points',
    },
    {
        name: 'available-roles',
        description: 'Check roles you can unlock based on your points',
    },
    {
        name: 'all-roles',
        description: 'List all roles and their required points',
    },
    {
        name: 'buy-role',
        description: 'Buy a role using your points',
        options: [
            {
                name: 'role',
                type: 3, // STRING
                description: 'The name of the role you want to buy',
                required: true,
            }
        ]
    }
];

// Register slash commands
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
(async () => {
    try {
        console.log('Refreshing application commands...');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        console.log('Successfully refreshed application commands.');
    } catch (error) {
        console.error(error);
    }
})();

// Bot login
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// Listen for messages and update points
client.on('messageCreate', (message) => {
    if (message.author.bot) return;

    // Increment user points
    const userId = message.author.id;
    if (!users[userId]) {
        users[userId] = { points: 0, roles: [] };
    }
    users[userId].points++;

    // Notify users when they reach new milestones
    const userPoints = users[userId].points;
    for (const [role, pointsRequired] of Object.entries(rolesConfig)) {
        if (userPoints >= pointsRequired && !users[userId].roles.includes(role)) {
            message.reply(`You now have **${userPoints} points**! Use \`/buy-role role:${role}\` to purchase the **${role}** role!`);
        }
    }
});

// Handle slash commands
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName, user, options, guild } = interaction;
    const userId = user.id;

    if (commandName === 'points') {
        const userPoints = users[userId]?.points || 0;
        await interaction.reply(`You have **${userPoints} points**.`);
    }

    if (commandName === 'available-roles') {
        const userPoints = users[userId]?.points || 0;
        const unlockedRoles = users[userId]?.roles || [];
        const availableRoles = Object.entries(rolesConfig)
            .filter(([role, pointsRequired]) => userPoints >= pointsRequired && !unlockedRoles.includes(role))
            .map(([role]) => role);

        if (availableRoles.length === 0) {
            await interaction.reply('You have no roles available to unlock.');
        } else {
            await interaction.reply(`You can unlock the following roles: **${availableRoles.join(', ')}**.`);
        }
    }

    if (commandName === 'all-roles') {
        const allRoles = Object.entries(rolesConfig)
            .map(([role, pointsRequired]) => `**${role}**: ${pointsRequired} points`)
            .join('\n');
        await interaction.reply(`Here are all the roles and their required points:\n${allRoles}`);
    }

    if (commandName === 'buy-role') {
        const roleName = options.getString('role');
        const userPoints = users[userId]?.points || 0;
        const unlockedRoles = users[userId]?.roles || [];
        const rolePoints = rolesConfig[roleName];
        const member = guild.members.cache.get(userId);
        const roleObj = guild.roles.cache.find(r => r.name === roleName);

        if (!rolePoints) {
            await interaction.reply(`The role **${roleName}** does not exist.`);
            return;
        }

        if (unlockedRoles.includes(roleName)) {
            await interaction.reply(`You already have the **${roleName}** role.`);
            return;
        }

        if (userPoints < rolePoints) {
            await interaction.reply(`You don't have enough points to buy the **${roleName}** role. You need **${rolePoints - userPoints}** more points.`);
            return;
        }

        if (roleObj) {
            member.roles.add(roleObj).catch(console.error);
            users[userId].points -= rolePoints; // Deduct points
            users[userId].roles.push(roleName); // Mark role as purchased
            await interaction.reply(`🎉 You have successfully purchased the **${roleName}** role!`);
        } else {
            await interaction.reply(`The role **${roleName}** does not exist on this server.`);
        }
    }
});

// Log the bot in
client.login(process.env.TOKEN);
