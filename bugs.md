# Bugs

## card cost text overlap

in the "building costs" section, the text for "Development Card" overlaps with the cost for it. This is because the text is too long and doesn't fit within the designated area.

## no feedback when a player tries to make a trade without sufficient resources

for example, if I have no stone, and I try to make a trade where I give stone, it correctly won't let me increase the number of stone in the trade, but it doesn't give me any feedback as to why. It would be helpful if there was a message that popped up saying something like "You don't have enough stone to make this trade".

update: this bug still occurs - no feedback when we try to increase the trade number. I bet because the input you used has the restriction build into it, which is great, it just makes it hard to get that feedback.

## reconnect not working

when a player refreshes the page, they do now successfully see "reconnecting..." but they don't actually reconnect to the game. we want their screen to load back to the state it was in before they refreshed, and we want them to be able to continue playing without any issues.

