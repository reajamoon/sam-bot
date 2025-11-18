// Shared member-facing messages for /rec commands (see docs/sam-voice-guidelines.md for style)
const updateMessages = {
    needIdentifier: 'You need to provide at least one identifier: `id`, `find_url`, or `find_ao3_id`.',
    notFound: (recId) => `I couldn't find a recommendation with ID ${recId} in our library. Maybe a typo?`,
    alreadyProcessing: 'That fic is already being processed! You’ll get a notification when it’s ready.',
    updateSuccess: 'This fic was just updated! Here’s the latest info.',
    updateNoEmbed: 'This fic was just updated! (No embed was generated.)',
    errorPreviously: 'There was an error parsing this fic previously. You can try again later.',
    addedToQueue: 'Your fic has been added to the parsing queue! I’ll notify you when it’s ready.',
    alreadyInQueue: 'This fic is already in the queue. You’ll get a notification when it’s ready!',
    genericError: 'There was an error updating the recommendation. You can try again.',
    siteProtection: 'Yeah, so this site has some serious security measures that are blocking me from reading the story details.\nThink of it like warding - keeps the bad stuff out, but also keeps me from doing my job.\nYou can bypass the parser to enter details manually, you need to include at least the URL, Title, and Author to do it.',
    notFound404: 'Oh man, that one gives a 404. The link may be broken or deleted.',
    forbidden403: 'Access restricted, 403? Hm, You might need to log in to view this story... I should be logged in.\nWeird error, gimme a minute and try again. Or the site might be at fault, check their status if this keeps happening.',
    connectionError: 'Connection error... The site may be down or unreachable. Yeah, probably server problems. Check their status page? Or it could be this shitty motel wifi again.',
    loginMessage: 'Hm, it says "You have to be logged in to view this story..." I should be logged in. Weird error, gimme a minute and try again.\nOr the site might be at fault, check their status if this keeps happening.',
    parseError: 'Uhh wait what was I supposed to be looking for? Can you give me just a second and run that by me again? I\'m *so* sorry!'
};

module.exports = updateMessages;
