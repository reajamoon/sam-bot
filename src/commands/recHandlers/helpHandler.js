// Handles navigation for the rec help menu buttons.
async function handleHelpNavigation(interaction) {
    try {
        const pages = createHelpPages();
        const customId = interaction.customId;
        let currentPage = 0;
        if (customId === 'rec_help_getting_started') {
            currentPage = 0;
        } else if (customId === 'rec_help_finding') {
            currentPage = 1;
        } else if (customId === 'rec_help_managing') {
            currentPage = 2;
        } else if (customId === 'rec_help_features') {
            currentPage = 3;
        }
        const navigationRow = createNavigationButtons(currentPage, pages.length);
        await interaction.update({
            embeds: [pages[currentPage]],
            components: [navigationRow]
        });
    } catch (error) {
        console.error('Error in handleHelpNavigation:', error);
        try {
            const { InteractionFlags } = require('discord.js');
            await interaction.reply({
                content: 'Sorry, something went wrong with the help navigation. Try using `/rec help` again.',
                flags: InteractionFlags.Ephemeral
            });
        } catch (replyError) {
            console.error('Failed to send error message:', replyError);
        }
    }
}

const { EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Centralized builder for rec help menu button IDs
function buildRecHelpButtonId(category) {
    return `rec_help_${category}`;
}

// Helper: Creates the help pages for the rec system.
function createHelpPages() {
    const pages = [];
    // Page 1: Welcome & Adding Recommendations
    const page1 = new EmbedBuilder()
        .setTitle('📚 The PB Bunker Library - Getting Started')
        .setDescription('Hey there. Look, I\'ve been keeping track of fanfiction for this server for a while now, and I\'ve got a pretty good system going. Let me walk you through how this whole thing works.')
        .setColor(0x8B4513)
        .addFields(
            {
                name: 'What This Is',
                value: 'Think of me as your personal librarian for the Bunker Library. I keep track of all the Destiel fics people recommend, make sure we don\'t have duplicates, and help everyone find something good to read when they need it.',
                inline: false
            },
            {
                name: '📝 Adding New Fics',
                value: '**Basic:** `/rec add url:<link>`\n' +
                       'Just give me the URL and I\'ll handle the rest. I\'ll grab the title, author, summary, word count - all that good stuff.\n\n' +
                       '**With extras:** `/rec add url:<link> tags:angst, hurt/comfort notes:Made me cry`\n' +
                       'Add your own tags and notes so people know what they\'re getting into.\n\n' +
                       '**Manual backup:** If the site\'s being difficult, you can tell me the basics:\n' +
                       '`/rec add url:<link> title:"Story Title" author:"Author Name"`',
                inline: false
            },
            {
                name: 'What Sites I Work With',
                value: 'I can pull data from **Archive of Our Own** (my favorite), **FanFiction.Net**, **Wattpad**, **LiveJournal**, **Dreamwidth**, and **Tumblr**. AO3 gives me the most detailed info, but I\'ll work with whatever you\'ve got.\n\n' +
                       '**Error Detection:** I\'ll let you know if links are broken or whatever.',
                inline: false
            }
        )
        .setFooter({ text: 'Getting Started • Use the category buttons below to navigate' });
    // Page 2: Finding & Reading Recommendations
        const page2 = new EmbedBuilder()
            .setTitle('📚 The PB Bunker Library - Finding Fics')
            .setDescription('So get this, if you can\'t think of what to read, I\'ve got you covered. Let me show you all the ways to discover your next great story.')
            .setColor(0x8B4513)
            .addFields(
                {
                    name: 'Random Recommendations',
                    value: '**Get anything:** `/rec random`\n' +
                           'I\'ll pick something at random from our collection.\n\n' +
                           '**Filter by tag:** `/rec random tag:angst`\n' +
                           'Tell me what kind of day you\'re having and I\'ll find something that matches.',
                    inline: false
                },
                {
                    name: 'Advanced Search',
                    value: '**Find exactly what you want:** `/rec search` lets you search by title, author, tags, rating, summary, and more.\n\n' +
                           '**Tag search logic:**\n' +
                           '- Use a comma (`,`) to search for fics with ANY of the listed tags (OR logic).\n' +
                           '- Use a plus (`+`) to require ALL tags in a group (AND logic).\n' +
                           '- Mix them for advanced searches!\n' +
                           '  - Example: `canon divergence+bottom dean winchester, angst` finds fics with BOTH "canon divergence" AND "bottom dean winchester", OR fics with "angst".\n' +
                           '- Spaces are ignored around tags.\n' +
                           '- You can combine with other fields like title, author, etc.',
                    inline: false
                },
                {
                    name: 'Library Stats',
                    value: '**See the numbers:** `/rec stats`\n' +
                           'Check how many fics we\'ve got, who\'s been contributing the most, that sort of thing.',
                    inline: false
                },
                {
                    name: 'Reading Experience',
                    value: 'Every recommendation I show you has clickable links. The title goes straight to the fic, and there\'s a big "🔗 Read Here" button.',
                    inline: false
                }
            )
            .setFooter({ text: 'Finding Fics • Use the category buttons below to navigate' });
    // Page 3: Managing Your Recommendations
    const page3 = new EmbedBuilder()
        .setTitle('📚 The PB Bunker Library - Managing Your Recs')
        .setDescription('Need to change something? I\'ve got you covered. Three ways to find your stuff for editing:')
        .setColor(0x8B4513)
        .addFields(
            {
                name: 'Finding Your Recommendations',
                value: '**Option 1 - Rec ID:** Every recommendation shows its ID number at the bottom\n' +
                       '`/rec update id:5` or `/rec remove id:5`\n\n' +
                       '**Option 2 - Full URL:** Use the complete web address\n' +
                       '`/rec update find_url:https://archiveofourown.org/works/12345`\n\n' +
                       '**Option 3 - AO3 Work ID:** Just the number (it\'s the number after works in every Ao3 URL)\n' +
                       '`/rec update find_ao3_id:12345` or `/rec remove ao3_id:12345`\n' +
                       '*Seriously, use the work ID. It\'s so much easier.*',
                inline: false
            },
            {
                name: 'Updating Stuff',
                value: '**Refresh metadata:** `/rec update find_ao3_id:12345`\n' +
                       'Gets the latest word count, chapters, status - useful when a fic updates.\n\n' +
                       '**Manual edits:** Update any field manually:\n' +
                       '`/rec update id:5 title:"New Title" author:"Author" summary:"New summary"`\n' +
                       '`/rec update id:5 rating:"Explicit" status:"Complete" wordcount:50000`\n\n' +
                       '**Mark as deleted:** `/rec update id:5 deleted:True`\n' +
                       'Keeps the rec in the library but marks it as deleted.\n\n' +
                       '**Change URL or tags:** Same as always:\n' +
                       '`/rec update id:5 new_url:<link> tags:new, tags notes:Updated thoughts`',
                inline: false
            },
            {
                name: 'Removing Recommendations',
                value: 'Same deal as updating - pick your method:\n' +
                       '`/rec remove id:5` or `/rec remove ao3_id:12345` or `/rec remove url:<full-url>`\n\n' +
                       '*You can only mess with your own recommendations unless you\'re a mod.*\n\n' +
                       'If you\'re the author of a story in PB\'s library and you need something corrected Cas can shoot the mods a message for you. Hit him up with his `/ModMail` command.',
                inline: false
            }
        )
        .setFooter({ text: 'Managing Your Recs • Use the category buttons below to navigate' });
    // Page 4: Features & Troubleshooting
    const page4 = new EmbedBuilder()
        .setTitle('📚 The PB Bunker Library - The Fine Print')
        .setDescription('I\'ve been doing this for a while, so I\'ve learned a few tricks. Here\'s what you should know:')
        .setColor(0x8B4513)
        .addFields(
            {
                name: 'Let Me Worry About The Details',
                value: '• **Parsing:** I grab titles, authors, summaries, word counts, chapter info, publication dates\n' +
                       '• **Error Detection:** I\'ll tell you if links are broken (404), restricted (403), or having connection issues\n' +
                       '• **Link Checking:** Random recommendations show warnings if links have gone bad\n' +
                       '• **Clickable Everything:** All my embeds have working links\n' +
                       '• **Duplicate Prevention:** I won\'t let you add the same URL twice\n' +
                       '• **Permission:** Only you (or mods) can edit your recommendations. If you\'re the author of a fic in my library and want something fixed Cas can help you get in touch with one of them with his `/ModMail` command.',
                inline: false
            },
            {
                name: 'When Shit Hits the Fan',
                value: '• **"Story Not Found (404)":** The link is broken - story was deleted, moved, or URL was wrong. I\'ll give you suggestions on what to do.\n' +
                       '• **"Access Restricted (403)":** Story is private, locked, or requires login. You can still add it manually and add in all the info by hand.\n' +
                       '• **"Site protection detected":** Cloudflare or similar is blocking me. Add the info manually.\n' +
                       '• **"Unknown interaction":** I probably restarted. Try again. If it keeps happening, have Cas send in a /modmail.\n' +
                       '• **Can\'t find your rec:** Double-check the ID/URL/work number.',
                inline: false
            },
            {
                name: 'File Attachments for Deleted Fics',
                value: 'Look, sometimes stories disappear from the internet. It happens. If you\'ve got a backup copy **and the author said it\'s okay**, you can attach it here.\n\n' +
                       '• `/rec update id:<number> deleted:True attachment:<file>`\n' +
                       '• I\'ll take TXT, PDF, EPUB, MOBI, DOC files - the usual suspects\n' +
                       '• Keep it under 10MB. I\'m not your personal Dropbox\n' +
                       '• **No author permission = mods delete it. Period.**\n\n' +
                       'Don\'t make me regret giving you this feature.',
                inline: false
            },
            {
                name: 'Pro Tips',
                value: '• AO3 Work IDs are your friend - much easier than remembering full URLs\n' +
                       '• Use tags to help people find the right mood\n' +
                       '• Add additional tags to oldschool fics pre tag days\n' +
                       '• Personal notes are great for warnings or why you loved it\n' +
                       '• Check `/rec stats` to see how the collection\'s growing',
                inline: false
            },
            {
                name: '📋 Quick Reference',
                value: '`/rec help` - This guide\n' +
                       '`/rec add url:<link>` - Add new fic\n' +
                       '`/rec random` - Get random recommendation\n' +
                       '`/rec update find_ao3_id:<number>` - Update by AO3 ID\n' +
                       '`/rec remove ao3_id:<number>` - Remove by AO3 ID\n' +
                       '`/rec stats` - Library statistics',
                inline: false
            }
        )
        .setFooter({ text: 'Features & Help • Use the category buttons below to navigate' });
    pages.push(page1, page2, page3, page4);
    return pages;
}

// Helper: Builds the navigation buttons for the help menu.
function createNavigationButtons(currentPage, totalPages) {
    const row = new ActionRowBuilder();
    const categories = [
        { id: 'getting_started', label: 'Getting Started', page: 0 },
        { id: 'finding', label: 'Finding Fics', page: 1 },
        { id: 'managing', label: 'Managing', page: 2 },
        { id: 'features', label: 'Features & Help', page: 3 }
    ];
    categories.forEach(category => {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(buildRecHelpButtonId(category.id))
                .setLabel(category.label)
                .setStyle(category.page === currentPage ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setDisabled(false)
        );
    });
    return row;
}

// Main help command handler
async function handleHelp(interaction) {
    if (Date.now() - interaction.createdTimestamp > 14 * 60 * 1000) {
        return await interaction.reply({
            content: 'That interaction took too long to process. Please try the command again.',
            flags: MessageFlags.Ephemeral
        });
    }
    const pages = createHelpPages();
    const currentPage = 0;
    const navigationRow = createNavigationButtons(currentPage, pages.length);
    await interaction.reply({
        embeds: [pages[currentPage]],
        components: [navigationRow],
        flags: MessageFlags.Ephemeral
    });
}

module.exports = {
    handleHelp,
    handleHelpNavigation,
    createHelpPages,
    createNavigationButtons
};
