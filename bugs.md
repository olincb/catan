# Bugs

## card cost text overlap

in the "building costs" section, the text for "Development Card" overlaps with the cost for it. This is because the text is too long and doesn't fit within the designated area.

## need error message for "insufficient resources"

when a player tries to build something but doesn't have enough resources, there should be an error message that pops up to inform them of the issue. Currently, I think it just says "invalid road location".

## no feedback when a player tries to make a trade without sufficient resources

for example, if I have no stone, and I try to make a trade where I give stone, it correctly won't let me increase the number of stone in the trade, but it doesn't give me any feedback as to why. It would be helpful if there was a message that popped up saying something like "You don't have enough stone to make this trade".

## nothing happens when you reject a trade

when a player receives a trade offer and clicks "reject", nothing happens other than a note in the game log. there should be some sort of feedback to the player that their rejection was successful, such as a message that pops up saying "You have rejected the trade offer". we should consider whether we should remove the trade from the screen - maybe we should keep it though, because the fact that the trade stands is still important information. maybe we add feedback within the trade box itself, which all players can see.
